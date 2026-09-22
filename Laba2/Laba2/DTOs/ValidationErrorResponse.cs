namespace Laba2.DTOs;

public class ValidationErrorResponse
{
    public string Message { get; set; } = "Validation failed";

    public Dictionary<string, List<string>> Errors { get; set; } = new();
}