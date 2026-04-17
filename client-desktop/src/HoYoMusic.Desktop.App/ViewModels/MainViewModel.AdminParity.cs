using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;
using System.Collections.Generic;
using System.IO;

namespace HoYoMusic.Desktop.App.ViewModels;

public partial class MainViewModel
{
    private readonly Dictionary<string, string> _adminArtistAvatarMap = new(StringComparer.OrdinalIgnoreCase);

    [ObservableProperty]
    private bool _isAdminGamesLoading;

    [ObservableProperty]
    private string _adminGamesStatusMessage = string.Empty;

    [ObservableProperty]
    private GameItem? _selectedAdminGame;

    [ObservableProperty]
    private string _adminGameName = string.Empty;

    [ObservableProperty]
    private string _adminGameNameEn = string.Empty;

    [ObservableProperty]
    private string _adminGameDescription = string.Empty;

    [ObservableProperty]
    private string _adminGameDisplayOrderText = "0";

    [ObservableProperty]
    private string _adminGameStatus = "active";

    [ObservableProperty]
    private string _adminGameCoverLocalPath = string.Empty;

    [ObservableProperty]
    private bool _isAdminArtistsLoading;

    [ObservableProperty]
    private string _adminArtistsStatusMessage = string.Empty;

    [ObservableProperty]
    private string _adminArtistSearchKeyword = string.Empty;

    [ObservableProperty]
    private ArtistAdminItem? _selectedAdminArtist;

    [ObservableProperty]
    private ArtistAliasItem? _selectedAdminArtistAlias;

    [ObservableProperty]
    private ArtistRoleAliasItem? _selectedAdminArtistRoleAlias;

    [ObservableProperty]
    private string _adminArtistEditName = string.Empty;

    [ObservableProperty]
    private string _adminArtistRoleMappingsText = string.Empty;

    [ObservableProperty]
    private string _adminArtistCanonicalName = string.Empty;

    [ObservableProperty]
    private string _adminArtistAliasNamesText = string.Empty;

    [ObservableProperty]
    private string _adminArtistCanonicalRole = string.Empty;

    [ObservableProperty]
    private string _adminArtistAliasRolesText = string.Empty;

    [ObservableProperty]
    private string _adminArtistAvatarLocalPath = string.Empty;

    [ObservableProperty]
    private string _adminArtistCurrentAvatarPath = string.Empty;

    [ObservableProperty]
    private bool _isAdminAnalyticsLoading;

    [ObservableProperty]
    private string _adminAnalyticsStatusMessage = string.Empty;

    [ObservableProperty]
    private int _adminAnalyticsTotalRequests;

    [ObservableProperty]
    private int _adminAnalyticsTodayRequests;

    [ObservableProperty]
    private int _adminAnalyticsUniqueVisitors;

    [ObservableProperty]
    private int _adminAnalyticsErrorRequests;

    [ObservableProperty]
    private int _adminAnalyticsAverageMs;

    partial void OnSelectedAdminGameChanged(GameItem? value)
    {
        if (value is null)
        {
            return;
        }

        AdminGameName = value.Name;
        AdminGameNameEn = value.NameEn ?? string.Empty;
        AdminGameDescription = value.Description ?? string.Empty;
        AdminGameDisplayOrderText = (value.DisplayOrder ?? 0).ToString();
        AdminGameStatus = string.IsNullOrWhiteSpace(value.Status) ? "active" : value.Status;
    }

    partial void OnSelectedAdminArtistChanged(ArtistAdminItem? value)
    {
        if (value is null)
        {
            return;
        }

        AdminArtistEditName = value.IsAlias && !string.IsNullOrWhiteSpace(value.CanonicalName)
            ? value.CanonicalName
            : value.Name;
        AdminArtistRoleMappingsText = string.Join(Environment.NewLine, value.Roles.Select(role => $"{role}={role}"));

        var targetArtistName = string.IsNullOrWhiteSpace(value.CanonicalName) ? value.Name : value.CanonicalName;
        AdminArtistCurrentAvatarPath = string.IsNullOrWhiteSpace(targetArtistName)
            ? string.Empty
            : _adminArtistAvatarMap.TryGetValue(targetArtistName, out var avatarPath)
                ? avatarPath
                : string.Empty;
    }

    [RelayCommand]
    private async Task RefreshAdminGamesAsync()
    {
        await LoadAdminGamesAsync();
    }

    [RelayCommand]
    private async Task CreateAdminGameAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var name = AdminGameName.Trim();
        if (name.Length == 0)
        {
            ErrorMessage = "游戏名称不能为空。";
            return;
        }

        IsBusy = true;
        try
        {
            var request = BuildGameUpsertRequest(name);
            await _gameService.CreateGameAsync(request);
            await LoadAdminGamesAsync();
            ClearAdminGameForm();
            SuccessMessage = "游戏创建成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "创建游戏失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateAdminGameAsync()
    {
        if (!IsAdmin || SelectedAdminGame is null)
        {
            ErrorMessage = "请先选择要更新的游戏。";
            return;
        }

        IsBusy = true;
        try
        {
            var request = BuildGameUpsertRequest(AdminGameName.Trim());
            await _gameService.UpdateGameAsync(SelectedAdminGame.Id, request);
            await LoadAdminGamesAsync();
            SuccessMessage = "游戏信息已更新。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新游戏失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void ClearAdminGameForm()
    {
        SelectedAdminGame = null;
        AdminGameName = string.Empty;
        AdminGameNameEn = string.Empty;
        AdminGameDescription = string.Empty;
        AdminGameDisplayOrderText = "0";
        AdminGameStatus = "active";
    }

    [RelayCommand]
    private async Task SearchAdminArtistsAsync()
    {
        await LoadAdminArtistsAsync(1);
    }

    [RelayCommand]
    private async Task RefreshAdminArtistsAsync()
    {
        await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
    }

    [RelayCommand]
    private async Task PreviousAdminArtistsPageAsync()
    {
        if (!HasPreviousAdminArtistsPage)
        {
            return;
        }

        await LoadAdminArtistsAsync(Math.Max(1, AdminArtistsPage - 1));
    }

    [RelayCommand]
    private async Task NextAdminArtistsPageAsync()
    {
        if (!HasNextAdminArtistsPage)
        {
            return;
        }

        await LoadAdminArtistsAsync(AdminArtistsPage + 1);
    }

    [RelayCommand]
    private async Task UpdateAdminArtistAsync()
    {
        if (!IsAdmin || SelectedAdminArtist is null)
        {
            ErrorMessage = "请先选择艺人。";
            return;
        }

        var sourceName = SelectedAdminArtist.Name;
        var targetName = AdminArtistEditName.Trim();
        if (targetName.Length == 0)
        {
            ErrorMessage = "艺人名称不能为空。";
            return;
        }

        var mappings = ParseRoleMappings(AdminArtistRoleMappingsText);

        IsBusy = true;
        try
        {
            await _artistService.UpdateArtistAsync(sourceName, new ArtistUpdateRequest
            {
                Name = targetName,
                RoleMappings = mappings,
            });

            await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
            SuccessMessage = "艺人信息已更新。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新艺人失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task MergeAdminArtistsAsync()
    {
        var canonical = AdminArtistCanonicalName.Trim();
        var aliases = SplitByLinesAndPunctuation(AdminArtistAliasNamesText);
        if (canonical.Length == 0 || aliases.Count == 0)
        {
            ErrorMessage = "请填写主名称和至少一个别名。";
            return;
        }

        IsBusy = true;
        try
        {
            await _artistService.MergeArtistsAsync(canonical, aliases);
            AdminArtistAliasNamesText = string.Empty;
            await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
            SuccessMessage = "艺人别名合并成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "合并艺人别名失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteAdminArtistAliasAsync()
    {
        if (SelectedAdminArtistAlias is null)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await _artistService.DeleteAliasAsync(SelectedAdminArtistAlias.Id);
            await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
            SuccessMessage = "别名已删除。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除别名失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task MergeAdminArtistRolesAsync()
    {
        var canonicalRole = AdminArtistCanonicalRole.Trim();
        var aliasRoles = SplitByLinesAndPunctuation(AdminArtistAliasRolesText);
        if (canonicalRole.Length == 0 || aliasRoles.Count == 0)
        {
            ErrorMessage = "请填写主角色和至少一个别名角色。";
            return;
        }

        IsBusy = true;
        try
        {
            await _artistService.MergeRolesAsync(canonicalRole, aliasRoles);
            AdminArtistAliasRolesText = string.Empty;
            await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
            SuccessMessage = "角色别名合并成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "合并角色别名失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteAdminArtistRoleAliasAsync()
    {
        if (SelectedAdminArtistRoleAlias is null)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await _artistService.DeleteRoleAliasAsync(SelectedAdminArtistRoleAlias.Id);
            await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
            SuccessMessage = "角色别名已删除。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除角色别名失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UploadAdminGameCoverAsync()
    {
        if (!IsAdmin || SelectedAdminGame is null)
        {
            ErrorMessage = "请先选择要上传封面的游戏。";
            return;
        }

        var localFilePath = AdminGameCoverLocalPath.Trim();
        if (localFilePath.Length == 0 || !File.Exists(localFilePath))
        {
            ErrorMessage = "请输入有效的本地封面文件路径。";
            return;
        }

        IsBusy = true;
        try
        {
            var updated = await _gameService.UploadGameCoverAsync(SelectedAdminGame.Id, localFilePath);
            await LoadAdminGamesAsync();
            SelectedAdminGame = Games.FirstOrDefault(item => item.Id == updated.Id);
            AdminGameCoverLocalPath = string.Empty;
            SuccessMessage = "游戏封面上传成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "上传游戏封面失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UploadAdminArtistAvatarAsync()
    {
        if (!IsAdmin || SelectedAdminArtist is null)
        {
            ErrorMessage = "请先选择艺人。";
            return;
        }

        var localFilePath = AdminArtistAvatarLocalPath.Trim();
        if (localFilePath.Length == 0 || !File.Exists(localFilePath))
        {
            ErrorMessage = "请输入有效的本地头像文件路径。";
            return;
        }

        var targetArtistName = string.IsNullOrWhiteSpace(SelectedAdminArtist.CanonicalName)
            ? SelectedAdminArtist.Name
            : SelectedAdminArtist.CanonicalName!;

        IsBusy = true;
        try
        {
            var avatarPath = await _artistService.UploadAvatarAsync(targetArtistName, localFilePath);
            AdminArtistCurrentAvatarPath = avatarPath;
            AdminArtistAvatarLocalPath = string.Empty;
            await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
            SuccessMessage = "艺人头像上传成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "上传艺人头像失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RefreshAdminAnalyticsAsync()
    {
        await LoadAdminAnalyticsAsync();
    }

    private async Task LoadAdminGamesAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        IsAdminGamesLoading = true;
        AdminGamesStatusMessage = "正在加载游戏列表...";
        try
        {
            await LoadGamesAsync();
            AdminGamesStatusMessage = Games.Count == 0 ? "暂无游戏数据。" : string.Empty;
        }
        catch (ApiException ex)
        {
            AdminGamesStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载游戏列表失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载游戏列表失败，请稍后重试。");
        }
        finally
        {
            IsAdminGamesLoading = false;
        }
    }

    private async Task LoadAdminArtistsAsync(int page = 1)
    {
        if (!IsAdmin)
        {
            return;
        }

        IsAdminArtistsLoading = true;
        AdminArtistsStatusMessage = "正在加载艺人数据...";
        try
        {
            var listTask = _artistService.GetArtistsAsync(
                page: Math.Max(1, page),
                limit: 50,
                search: string.IsNullOrWhiteSpace(AdminArtistSearchKeyword) ? null : AdminArtistSearchKeyword.Trim());
            var aliasTask = _artistService.GetAliasesAsync();
            var roleAliasTask = _artistService.GetRoleAliasesAsync();
            var avatarsTask = _artistService.GetAvatarsAsync();

            var list = await listTask;
            var aliases = await aliasTask;
            var roleAliases = await roleAliasTask;
            var avatars = await avatarsTask;

            _adminArtistAvatarMap.Clear();
            foreach (var pair in avatars)
            {
                if (!string.IsNullOrWhiteSpace(pair.Key) && !string.IsNullOrWhiteSpace(pair.Value))
                {
                    _adminArtistAvatarMap[pair.Key] = pair.Value;
                }
            }

            AdminArtists.Clear();
            foreach (var item in list.Artists)
            {
                AdminArtists.Add(item);
            }

            AdminArtistAliases.Clear();
            foreach (var item in aliases)
            {
                AdminArtistAliases.Add(item);
            }

            AdminArtistRoleAliases.Clear();
            foreach (var item in roleAliases)
            {
                AdminArtistRoleAliases.Add(item);
            }

            AdminArtistsPage = list.Pagination?.Page > 0 ? list.Pagination.Page : Math.Max(1, page);
            AdminArtistsTotalPages = Math.Max(1, list.Pagination?.TotalPages ?? 1);
            AdminArtistsTotal = Math.Max(0, list.Pagination?.Total ?? AdminArtists.Count);

            if (SelectedAdminArtist is not null)
            {
                SelectedAdminArtist = AdminArtists.FirstOrDefault(item =>
                    string.Equals(item.Name, SelectedAdminArtist.Name, StringComparison.OrdinalIgnoreCase));
            }

            var selectedArtistName = SelectedAdminArtist is null
                ? null
                : (string.IsNullOrWhiteSpace(SelectedAdminArtist.CanonicalName)
                    ? SelectedAdminArtist.Name
                    : SelectedAdminArtist.CanonicalName);
            AdminArtistCurrentAvatarPath = string.IsNullOrWhiteSpace(selectedArtistName)
                ? string.Empty
                : _adminArtistAvatarMap.TryGetValue(selectedArtistName!, out var selectedAvatar)
                    ? selectedAvatar
                    : string.Empty;

            AdminArtistsStatusMessage = AdminArtists.Count == 0 ? "没有匹配的艺人。" : string.Empty;
        }
        catch (ApiException ex)
        {
            AdminArtistsStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载艺人管理数据失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载艺人管理数据失败，请稍后重试。");
        }
        finally
        {
            IsAdminArtistsLoading = false;
        }
    }

    private async Task LoadAdminAnalyticsAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        IsAdminAnalyticsLoading = true;
        AdminAnalyticsStatusMessage = "正在加载分析数据...";
        try
        {
            var overviewTask = _analyticsService.GetOverviewAsync();
            var hourlyTask = _analyticsService.GetHourlyAsync();
            var recentTask = _analyticsService.GetRecentAsync(20);
            var pagesTask = _analyticsService.GetPagesAsync(7);
            var statusCodesTask = _analyticsService.GetStatusCodesAsync(7);

            var overview = await overviewTask;
            var hourly = await hourlyTask;
            var recent = await recentTask;
            var pages = await pagesTask;
            var statusCodes = await statusCodesTask;

            AdminAnalyticsTotalRequests = overview.Total;
            AdminAnalyticsTodayRequests = overview.Today;
            AdminAnalyticsUniqueVisitors = overview.Unique7d;
            AdminAnalyticsErrorRequests = overview.Errors;
            AdminAnalyticsAverageMs = overview.AvgMs;

            AdminAnalyticsHourly.Clear();
            foreach (var item in hourly.OrderBy(item => item.Hour))
            {
                AdminAnalyticsHourly.Add(item);
            }

            AdminAnalyticsRecentVisits.Clear();
            foreach (var item in recent)
            {
                AdminAnalyticsRecentVisits.Add(item);
            }

            AdminAnalyticsPages.Clear();
            foreach (var item in pages)
            {
                AdminAnalyticsPages.Add(item);
            }

            AdminAnalyticsStatusCodes.Clear();
            foreach (var item in statusCodes)
            {
                AdminAnalyticsStatusCodes.Add(item);
            }

            AdminAnalyticsStatusMessage = string.Empty;
            OnPropertyChanged(nameof(AdminAnalyticsSummary));
        }
        catch (ApiException ex)
        {
            AdminAnalyticsStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载分析数据失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载分析数据失败，请稍后重试。");
        }
        finally
        {
            IsAdminAnalyticsLoading = false;
        }
    }

    private GameUpsertRequest BuildGameUpsertRequest(string name)
    {
        var hasOrder = int.TryParse(AdminGameDisplayOrderText, out var displayOrder);
        return new GameUpsertRequest
        {
            Name = string.IsNullOrWhiteSpace(name) ? null : name,
            NameEn = string.IsNullOrWhiteSpace(AdminGameNameEn) ? null : AdminGameNameEn.Trim(),
            Description = string.IsNullOrWhiteSpace(AdminGameDescription) ? null : AdminGameDescription.Trim(),
            DisplayOrder = hasOrder ? displayOrder : 0,
            Status = string.IsNullOrWhiteSpace(AdminGameStatus) ? "active" : AdminGameStatus.Trim(),
        };
    }

    private static IReadOnlyList<ArtistRoleMapping> ParseRoleMappings(string text)
    {
        var lines = SplitByLinesAndPunctuation(text);
        var list = new List<ArtistRoleMapping>();
        foreach (var line in lines)
        {
            var pair = line.Split('=', 2, StringSplitOptions.TrimEntries);
            if (pair.Length != 2 || pair[0].Length == 0 || pair[1].Length == 0)
            {
                continue;
            }

            list.Add(new ArtistRoleMapping { From = pair[0], To = pair[1] });
        }

        return list;
    }

    private static List<string> SplitByLinesAndPunctuation(string text)
    {
        return text
            .Split(new[] { '\r', '\n', ';', '；', ',', '，' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Trim())
            .Where(item => item.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}

