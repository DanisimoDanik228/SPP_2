using Laba2.DTOs;
using Laba2.Services;
using Microsoft.AspNetCore.Mvc;

namespace Laba2.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ProductsController : ControllerBase
{
    private readonly ProductService _service;

    public ProductsController(ProductService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search = null)
    {
        var products = await _service.GetAllAsync(search);
        return Ok(products);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var product = await _service.GetByIdAsync(id);
        return product is null
            ? NotFound(new { message = $"Product with id {id} was not found." })
            : Ok(product);
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Create([FromForm] CreateProductDto dto)
    {
        var (product, errors) = await _service.CreateAsync(dto);
        if (errors is not null)
        {
            return BadRequest(new ValidationErrorResponse { Errors = errors });
        }

        return CreatedAtAction(nameof(GetById), new { id = product!.Id }, product);
    }

    [HttpPut("{id:int}")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> Update(int id, [FromForm] UpdateProductDto dto)
    {
        var (notFound, product, errors) = await _service.UpdateAsync(id, dto);
        if (notFound)
        {
            return NotFound(new { message = $"Product with id {id} was not found." });
        }

        if (errors is not null)
        {
            return BadRequest(new ValidationErrorResponse { Errors = errors });
        }

        return Ok(product);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted
            ? NoContent()
            : NotFound(new { message = $"Product with id {id} was not found." });
    }
}