namespace Laba2.DTOs;

public class CreateProductDto
{
    public string? Name { get; set; }

    public string? Description { get; set; }

    public decimal? Price { get; set; }

    public string? Category { get; set; }

    public IFormFile? Image { get; set; }
}