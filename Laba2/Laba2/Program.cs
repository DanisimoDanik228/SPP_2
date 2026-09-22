using System.Globalization;
using Laba2.Data;
using Laba2.DTOs;
using Laba2.Services;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState
                .Where(kv => kv.Value?.Errors.Count > 0)
                .ToDictionary(
                    kv => ToCamelCase(kv.Key),
                    kv => kv.Value!.Errors.Select(e => e.ErrorMessage).ToList());

            return new Microsoft.AspNetCore.Mvc.BadRequestObjectResult(
                new ValidationErrorResponse { Errors = errors });
        };

        static string ToCamelCase(string key)
        {
            if (string.IsNullOrEmpty(key))
            {
                return key;
            }

            var lastSegment = key.Contains('.') ? key[(key.LastIndexOf('.') + 1)..] : key;
            return char.ToLowerInvariant(lastSegment[0]) + lastSegment[1..];
        }
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo
    {
        Title = "ProductHub API",
        Version = "v1",
        Description = "REST API for the ProductHub SPA catalog."
    });
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:8080",
                "http://frontend")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var invariant = CultureInfo.InvariantCulture;
    options.DefaultRequestCulture = new RequestCulture(invariant);
    options.SupportedCultures = [invariant];
    options.SupportedUICultures = [invariant];
    options.RequestCultureProviders.Clear();
});

builder.Services.AddScoped<ProductService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    db.Database.Migrate();
}

app.UseRequestLocalization();
app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "ProductHub API v1");
});

app.UseCors("Frontend");
app.UseStaticFiles();

app.MapControllers();

app.Run();