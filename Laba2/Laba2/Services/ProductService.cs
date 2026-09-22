using Laba2.Data;
using Laba2.DTOs;
using Laba2.Models;
using Microsoft.EntityFrameworkCore;

namespace Laba2.Services;

public class ProductService
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    private const long MaxImageSizeBytes = 5 * 1024 * 1024;
    private const int MaxNameLength = 100;
    private const int MaxDescriptionLength = 500;
    private const int MaxCategoryLength = 50;

    private readonly ApplicationDbContext _db;
    private readonly IWebHostEnvironment _env;

    public ProductService(ApplicationDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public async Task<List<ProductResponseDto>> GetAllAsync(string? search)
    {
        var query = _db.Products.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(p =>
                p.Name.Contains(term) ||
                (p.Description != null && p.Description.Contains(term)) ||
                p.Category.Contains(term));
        }

        var products = await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
        return products.Select(ToDto).ToList();
    }

    public async Task<ProductResponseDto?> GetByIdAsync(int id)
    {
        var product = await _db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
        return product is null ? null : ToDto(product);
    }

    public async Task<(ProductResponseDto? Product, Dictionary<string, List<string>>? Errors)> CreateAsync(CreateProductDto dto)
    {
        var errors = Validate(dto.Name, dto.Description, dto.Price, dto.Category);
        if (errors.Count > 0)
        {
            return (null, errors);
        }

        string? imageUrl = null;
        if (dto.Image is not null)
        {
            var (path, error) = await SaveImageAsync(dto.Image);
            if (error is not null)
            {
                return (null, new Dictionary<string, List<string>> { ["image"] = [error] });
            }

            imageUrl = path;
        }

        var product = new Product
        {
            Name = dto.Name!.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            Price = dto.Price!.Value,
            Category = dto.Category!.Trim(),
            ImageUrl = imageUrl,
            CreatedAt = DateTime.UtcNow
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        return (ToDto(product), null);
    }

    public async Task<(bool NotFound, ProductResponseDto? Product, Dictionary<string, List<string>>? Errors)> UpdateAsync(
        int id, UpdateProductDto dto)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
        {
            return (true, null, null);
        }

        var errors = Validate(dto.Name, dto.Description, dto.Price, dto.Category);
        if (errors.Count > 0)
        {
            return (false, null, errors);
        }

        string? imageUrl = product.ImageUrl;
        if (dto.Image is not null)
        {
            var (path, error) = await SaveImageAsync(dto.Image);
            if (error is not null)
            {
                return (false, null, new Dictionary<string, List<string>> { ["image"] = [error] });
            }

            if (!string.IsNullOrWhiteSpace(product.ImageUrl))
            {
                DeleteImageFile(product.ImageUrl);
            }

            imageUrl = path;
        }

        product.Name = dto.Name!.Trim();
        product.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        product.Price = dto.Price!.Value;
        product.Category = dto.Category!.Trim();
        product.ImageUrl = imageUrl;

        await _db.SaveChangesAsync();
        return (false, ToDto(product), null);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
        {
            return false;
        }

        _db.Products.Remove(product);
        await _db.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(product.ImageUrl))
        {
            DeleteImageFile(product.ImageUrl);
        }

        return true;
    }

    private async Task<(string? Url, string? Error)> SaveImageAsync(IFormFile file)
    {
        if (file.Length == 0)
        {
            return (null, "Image file is empty.");
        }

        if (file.Length > MaxImageSizeBytes)
        {
            return (null, "Image must be smaller than 5 MB.");
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
        {
            return (null, "Only JPG, JPEG, PNG, GIF and WEBP images are allowed.");
        }

        var uploadsDirectory = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads");
        Directory.CreateDirectory(uploadsDirectory);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(uploadsDirectory, fileName);

        await using var stream = new FileStream(fullPath, FileMode.Create);
        await file.CopyToAsync(stream);

        return ($"/uploads/{fileName}", null);
    }

    private void DeleteImageFile(string imageUrl)
    {
        try
        {
            var relativePath = imageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), relativePath);
            if (File.Exists(fullPath))
            {
                File.Delete(fullPath);
            }
        }
        catch (IOException)
        {
            // Deleting a file is best effort: it must never break the API call.
        }
    }

    private static Dictionary<string, List<string>> Validate(string? name, string? description, decimal? price, string? category)
    {
        var errors = new Dictionary<string, List<string>>();

        void Add(string key, string message)
        {
            if (!errors.TryGetValue(key, out var list))
            {
                list = [];
                errors[key] = list;
            }

            list.Add(message);
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            Add("name", "Name is required.");
        }
        else if (name.Trim().Length is < 2 or > MaxNameLength)
        {
            Add("name", $"Name must be between 2 and {MaxNameLength} characters.");
        }

        if (!string.IsNullOrWhiteSpace(description) && description.Trim().Length > MaxDescriptionLength)
        {
            Add("description", $"Description must be at most {MaxDescriptionLength} characters.");
        }

        if (!price.HasValue)
        {
            Add("price", "Price is required.");
        }
        else if (price.Value <= 0)
        {
            Add("price", "Price must be greater than 0.");
        }
        else if (price.Value > 1_000_000m)
        {
            Add("price", "Price must be at most 1 000 000.");
        }

        if (string.IsNullOrWhiteSpace(category))
        {
            Add("category", "Category is required.");
        }
        else if (category.Trim().Length is < 2 or > MaxCategoryLength)
        {
            Add("category", $"Category must be between 2 and {MaxCategoryLength} characters.");
        }

        return errors;
    }

    private static ProductResponseDto ToDto(Product product) => new(
        product.Id,
        product.Name,
        product.Description,
        product.Price,
        product.Category,
        product.ImageUrl,
        product.CreatedAt);
}