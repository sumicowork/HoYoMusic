using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class QueryStringBuilderTests
{
    [Fact]
    public void ToString_WithNoParameters_ReturnsEmptyString()
    {
        var query = new QueryStringBuilder().ToString();

        Assert.Equal(string.Empty, query);
    }

    [Fact]
    public void Add_WithStringAndCsv_FormatsExpectedQuery()
    {
        var query = new QueryStringBuilder()
            .Add("search", "A B")
            .AddCsv("game_ids", [7, 7, -1, 9])
            .ToString();

        Assert.Equal("?search=A%20B&game_ids=7,9", query);
    }

    [Fact]
    public void Add_WithNullValue_IgnoresEntry()
    {
        var query = new QueryStringBuilder()
            .Add("game_id", (int?)null)
            .Add("limit", 10)
            .ToString();

        Assert.Equal("?limit=10", query);
    }
}

