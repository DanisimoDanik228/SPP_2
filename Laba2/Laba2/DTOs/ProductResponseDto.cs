namespace Laba2.DTOs;

public record ProductResponseDto(
    int Id,
    string Name,
    string? Description,
    decimal Price,
    string Category,
    string? ImageUrl,
    DateTime CreatedAt);