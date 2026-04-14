namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class QueryStringBuilder
{
    private readonly List<string> _pairs = [];

    public QueryStringBuilder Add(string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(value))
        {
            return this;
        }

        _pairs.Add($"{Uri.EscapeDataString(key)}={Uri.EscapeDataString(value)}");
        return this;
    }

    public QueryStringBuilder Add(string key, int? value)
    {
        if (value is null)
        {
            return this;
        }

        return Add(key, value.Value.ToString());
    }

    public QueryStringBuilder Add(string key, bool? value)
    {
        if (value is null)
        {
            return this;
        }

        return Add(key, value.Value ? "true" : "false");
    }

    public QueryStringBuilder AddCsv(string key, IEnumerable<int>? values)
    {
        if (values is null)
        {
            return this;
        }

        var normalized = values.Where(item => item > 0).Distinct().ToArray();
        if (normalized.Length == 0)
        {
            return this;
        }

        _pairs.Add($"{Uri.EscapeDataString(key)}={string.Join(",", normalized)}");
        return this;
    }

    public override string ToString()
    {
        return _pairs.Count == 0
            ? string.Empty
            : $"?{string.Join("&", _pairs)}";
    }
}


