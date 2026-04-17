using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;
using System.Threading;
using Windows.Storage;
using Windows.System;

namespace HoYoMusic.Desktop.App.ViewModels;


public partial class MainViewModel
{
    [RelayCommand]
    private void OpenAdminSection(string? section)
    {
        if (!IsAdmin)
        {
            ErrorMessage = "仅管理员可访问管理页面。";
            return;
        }

        SelectedAdminSection = section switch
        {
            AdminSectionUsers => AdminSectionUsers,
            AdminSectionTags => AdminSectionTags,
            AdminSectionGames => AdminSectionGames,
            AdminSectionArtists => AdminSectionArtists,
            AdminSectionAlbums => AdminSectionAlbums,
            AdminSectionMusicSources => AdminSectionMusicSources,
            AdminSectionAnalytics => AdminSectionAnalytics,
            AdminSectionSettings => AdminSectionSettings,
            _ => AdminSectionUsers,
        };
    }

    [RelayCommand]
    private async Task RefreshAdminUsersAsync()
    {
        await LoadAdminUsersAsync(Math.Max(AdminUsersPage, 1));
    }

    [RelayCommand]
    private async Task PreviousAdminUsersPageAsync()
    {
        if (!HasPreviousAdminUsersPage)
        {
            return;
        }

        await LoadAdminUsersAsync(Math.Max(1, AdminUsersPage - 1));
    }

    [RelayCommand]
    private async Task NextAdminUsersPageAsync()
    {
        if (!HasNextAdminUsersPage)
        {
            return;
        }

        await LoadAdminUsersAsync(AdminUsersPage + 1);
    }

    [RelayCommand]
    private async Task ToggleAdminUserRoleAsync(AdminUserItem? user)
    {
        if (!IsAdmin || user is null)
        {
            return;
        }

        IsBusy = true;
        try
        {
            await _userService.UpdateRoleAsync(user.Id, !user.IsAdmin);
            await LoadAdminUsersAsync(Math.Max(AdminUsersPage, 1));
            SuccessMessage = $"已更新用户角色：{user.Username}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新用户角色失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task ToggleAdminUserStatusAsync(AdminUserItem? user)
    {
        if (!IsAdmin || user is null)
        {
            return;
        }

        var nextStatus = string.Equals(user.AccountStatus, "disabled", StringComparison.OrdinalIgnoreCase)
            ? "active"
            : "disabled";

        IsBusy = true;
        try
        {
            await _userService.UpdateStatusAsync(user.Id, nextStatus);
            await LoadAdminUsersAsync(Math.Max(AdminUsersPage, 1));
            SuccessMessage = $"已更新用户状态：{user.Username} -> {nextStatus}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新用户状态失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task ResetAdminUserPasswordAsync(AdminUserItem? user)
    {
        if (!IsAdmin || user is null)
        {
            return;
        }

        var temporaryPassword = $"Temp{DateTime.Now:MMddHHmm}!";
        IsBusy = true;
        try
        {
            await _userService.ResetPasswordAsync(user.Id, temporaryPassword);
            SuccessMessage = $"{user.Username} 密码已重置为临时密码：{temporaryPassword}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "重置用户密码失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RefreshAdminTagsAsync()
    {
        await LoadAdminTagsAsync();
    }

    [RelayCommand]
    private void ClearAdminTagForm()
    {
        SelectedAdminTag = null;
        SelectedAdminTagAssignGroup = null;
        SelectedAdminTagParent = null;
        AdminTagName = string.Empty;
        AdminTagColor = "#6B9EFF";
        AdminTagDescription = string.Empty;
        AdminTagGroupIdText = string.Empty;
        AdminTagParentIdText = string.Empty;
        AdminTagIcon = string.Empty;
        AdminTagDisplayOrderText = string.Empty;
    }

    [RelayCommand]
    private async Task CreateAdminTagAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(AdminTagName))
        {
            ErrorMessage = "请输入标签名称。";
            return;
        }

        IsBusy = true;
        try
        {
            var created = await _tagService.CreateTagAsync(new TagUpsertRequest
            {
                Name = AdminTagName.Trim(),
                Color = string.IsNullOrWhiteSpace(AdminTagColor) ? null : AdminTagColor.Trim(),
                Description = string.IsNullOrWhiteSpace(AdminTagDescription) ? null : AdminTagDescription.Trim(),
                GroupId = ParseIntOrNull(AdminTagGroupIdText),
                ParentId = ParseIntOrNull(AdminTagParentIdText),
                Icon = string.IsNullOrWhiteSpace(AdminTagIcon) ? null : AdminTagIcon.Trim(),
                DisplayOrder = ParseIntOrNull(AdminTagDisplayOrderText),
            });

            await LoadAdminTagsAsync();
            SelectedAdminTag = AdminTags.FirstOrDefault(item => item.Id == created.Id);
            SuccessMessage = $"标签已创建：{created.Name}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "创建标签失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateAdminTagAsync()
    {
        if (!IsAdmin || SelectedAdminTag is null)
        {
            ErrorMessage = "请先选择要更新的标签。";
            return;
        }

        if (string.IsNullOrWhiteSpace(AdminTagName))
        {
            ErrorMessage = "请输入标签名称。";
            return;
        }

        IsBusy = true;
        try
        {
            var updated = await _tagService.UpdateTagAsync(SelectedAdminTag.Id, new TagUpsertRequest
            {
                Name = AdminTagName.Trim(),
                Color = string.IsNullOrWhiteSpace(AdminTagColor) ? null : AdminTagColor.Trim(),
                Description = string.IsNullOrWhiteSpace(AdminTagDescription) ? null : AdminTagDescription.Trim(),
                GroupId = ParseIntOrNull(AdminTagGroupIdText),
                ParentId = ParseIntOrNull(AdminTagParentIdText),
                Icon = string.IsNullOrWhiteSpace(AdminTagIcon) ? null : AdminTagIcon.Trim(),
                DisplayOrder = ParseIntOrNull(AdminTagDisplayOrderText),
            });

            await LoadAdminTagsAsync();
            SelectedAdminTag = AdminTags.FirstOrDefault(item => item.Id == updated.Id);
            SuccessMessage = $"标签已更新：{updated.Name}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新标签失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteAdminTagAsync()
    {
        if (!IsAdmin || SelectedAdminTag is null)
        {
            ErrorMessage = "请先选择要删除的标签。";
            return;
        }

        IsBusy = true;
        try
        {
            var removedName = SelectedAdminTag.Name;
            await _tagService.DeleteTagAsync(SelectedAdminTag.Id);
            await LoadAdminTagsAsync();
            ClearAdminTagForm();
            SuccessMessage = $"标签已删除：{removedName}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除标签失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void ClearAdminTagGroupForm()
    {
        SelectedAdminTagGroup = null;
        SelectedAdminTagGroupParent = null;
        AdminTagGroupName = string.Empty;
        AdminTagGroupDescription = string.Empty;
        AdminTagGroupIcon = string.Empty;
        AdminTagGroupDisplayOrderText = string.Empty;
        AdminTagGroupParentIdText = string.Empty;
    }

    [RelayCommand]
    private async Task CreateAdminTagGroupAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(AdminTagGroupName))
        {
            ErrorMessage = "请输入标签分组名称。";
            return;
        }

        IsBusy = true;
        try
        {
            var created = await _tagService.CreateTagGroupAsync(new TagGroupUpsertRequest
            {
                Name = AdminTagGroupName.Trim(),
                Description = string.IsNullOrWhiteSpace(AdminTagGroupDescription) ? null : AdminTagGroupDescription.Trim(),
                Icon = string.IsNullOrWhiteSpace(AdminTagGroupIcon) ? null : AdminTagGroupIcon.Trim(),
                DisplayOrder = ParseIntOrNull(AdminTagGroupDisplayOrderText),
                ParentGroupId = ParseIntOrNull(AdminTagGroupParentIdText),
            });

            await LoadAdminTagsAsync();
            SelectedAdminTagGroup = AdminTagGroups.FirstOrDefault(item => item.Id == created.Id);
            SuccessMessage = $"标签分组已创建：{created.Name}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "创建标签分组失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateAdminTagGroupAsync()
    {
        if (!IsAdmin || SelectedAdminTagGroup is null)
        {
            ErrorMessage = "请先选择要更新的标签分组。";
            return;
        }

        if (string.IsNullOrWhiteSpace(AdminTagGroupName))
        {
            ErrorMessage = "请输入标签分组名称。";
            return;
        }

        IsBusy = true;
        try
        {
            var updated = await _tagService.UpdateTagGroupAsync(SelectedAdminTagGroup.Id, new TagGroupUpsertRequest
            {
                Name = AdminTagGroupName.Trim(),
                Description = string.IsNullOrWhiteSpace(AdminTagGroupDescription) ? null : AdminTagGroupDescription.Trim(),
                Icon = string.IsNullOrWhiteSpace(AdminTagGroupIcon) ? null : AdminTagGroupIcon.Trim(),
                DisplayOrder = ParseIntOrNull(AdminTagGroupDisplayOrderText),
                ParentGroupId = ParseIntOrNull(AdminTagGroupParentIdText),
            });

            await LoadAdminTagsAsync();
            SelectedAdminTagGroup = AdminTagGroups.FirstOrDefault(item => item.Id == updated.Id);
            SuccessMessage = $"标签分组已更新：{updated.Name}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新标签分组失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteAdminTagGroupAsync()
    {
        if (!IsAdmin || SelectedAdminTagGroup is null)
        {
            ErrorMessage = "请先选择要删除的标签分组。";
            return;
        }

        IsBusy = true;
        try
        {
            var removedName = SelectedAdminTagGroup.Name;
            await _tagService.DeleteTagGroupAsync(SelectedAdminTagGroup.Id);
            await LoadAdminTagsAsync();
            ClearAdminTagGroupForm();
            SuccessMessage = $"标签分组已删除：{removedName}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除标签分组失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RefreshAdminSettingsAsync()
    {
        await LoadAdminMaintenanceConfigAsync();
        await LoadAdminFeedbackAsync(Math.Max(AdminFeedbackPage, 1));
    }

    [RelayCommand]
    private async Task SaveAdminMaintenanceConfigAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        IsBusy = true;
        try
        {
            if (!TryParseAdminIsoDateTime(AdminMaintenanceExpectedEndTime, out var normalizedExpectedEndTime))
            {
                ErrorMessage = "预计结束时间格式无效，请使用 ISO 时间，例如 2026-04-15T20:00:00+08:00。";
                return;
            }

            var updated = await _siteConfigService.UpdateAdminMaintenanceModeAsync(new MaintenanceModeConfig
            {
                Enabled = AdminMaintenanceEnabled,
                Message = AdminMaintenanceMessage,
                ExpectedEndTime = normalizedExpectedEndTime,
                Version = "desktop-admin",
            });

            AdminMaintenanceEnabled = updated.Enabled;
            AdminMaintenanceMessage = updated.Message;
            AdminMaintenanceExpectedEndTime = updated.ExpectedEndTime ?? string.Empty;
            ShowAdminSettingsStatus = true;
            AdminSettingsStatusMessage = "维护配置已保存并通过格式校验。";
            SuccessMessage = "维护配置已保存。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "保存维护配置失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SaveAdminFirstVisitConfigAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var minStaySeconds = ParseIntOrNull(AdminFirstVisitMinStaySecondsText) ?? 5;
        minStaySeconds = Math.Clamp(minStaySeconds, 5, 120);

        IsBusy = true;
        try
        {
            var updated = await _siteConfigService.UpdateAdminFirstVisitModalAsync(new FirstVisitModalConfig
            {
                Enabled = AdminFirstVisitEnabled,
                Title = AdminFirstVisitTitle,
                Content = AdminFirstVisitContent,
                MinStaySeconds = minStaySeconds,
                Version = string.IsNullOrWhiteSpace(AdminFirstVisitVersion) ? "desktop-admin" : AdminFirstVisitVersion.Trim(),
            });

            AdminFirstVisitEnabled = updated.Enabled;
            AdminFirstVisitTitle = updated.Title;
            AdminFirstVisitContent = updated.Content;
            AdminFirstVisitMinStaySecondsText = updated.MinStaySeconds.ToString();
            AdminFirstVisitVersion = updated.Version;
            ShowAdminSettingsStatus = true;
            AdminSettingsStatusMessage = "首次访问配置已保存（最短停留秒数已按后端规则校验）。";
            SuccessMessage = "首次访问弹窗配置已保存。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "保存首次访问弹窗配置失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SaveAdminComplianceConfigAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        IsBusy = true;
        try
        {
            var updated = await _siteConfigService.UpdateAdminComplianceConfigAsync(new SiteComplianceConfig
            {
                Enabled = AdminComplianceEnabled,
                IcpNumber = AdminComplianceIcpNumber.Trim(),
                PublicSecurityNumber = AdminCompliancePublicSecurityNumber.Trim(),
            });

            AdminComplianceEnabled = updated.Enabled;
            AdminComplianceIcpNumber = updated.IcpNumber;
            AdminCompliancePublicSecurityNumber = updated.PublicSecurityNumber;
            ShowAdminSettingsStatus = true;
            AdminSettingsStatusMessage = "备案配置已保存。";
            SuccessMessage = "备案配置已保存。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "保存备案配置失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SendAdminTestEmailAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(AdminTestEmail))
        {
            ErrorMessage = "请输入测试邮箱。";
            return;
        }

        IsBusy = true;
        try
        {
            var responseMessage = await _siteConfigService.SendAdminTestEmailAsync(AdminTestEmail.Trim());
            SuccessMessage = string.IsNullOrWhiteSpace(responseMessage) ? "测试邮件发送成功。" : responseMessage;
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "发送测试邮件失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RefreshAdminFeedbackAsync()
    {
        await LoadAdminFeedbackAsync(Math.Max(AdminFeedbackPage, 1));
    }

    [RelayCommand]
    private async Task PreviousAdminFeedbackPageAsync()
    {
        if (!HasPreviousAdminFeedbackPage)
        {
            return;
        }

        await LoadAdminFeedbackAsync(Math.Max(1, AdminFeedbackPage - 1));
    }

    [RelayCommand]
    private async Task NextAdminFeedbackPageAsync()
    {
        if (!HasNextAdminFeedbackPage)
        {
            return;
        }

        await LoadAdminFeedbackAsync(AdminFeedbackPage + 1);
    }

    [RelayCommand]
    private async Task LoadAdminDiscsAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var albumId = ParsePositiveIntOrNull(AdminAlbumIdText);
        if (!albumId.HasValue)
        {
            ErrorMessage = "请输入有效的专辑 ID。";
            return;
        }

        await LoadAdminDiscsCoreAsync(albumId.Value);
    }

    [RelayCommand]
    private void ClearAdminDiscForm()
    {
        SelectedAdminDisc = null;
        AdminDiscNumberText = string.Empty;
        AdminDiscTitle = string.Empty;
    }

    [RelayCommand]
    private async Task CreateAdminDiscAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var albumId = ParsePositiveIntOrNull(AdminAlbumIdText);
        if (!albumId.HasValue)
        {
            ErrorMessage = "请输入有效的专辑 ID。";
            return;
        }

        var discNumber = ParsePositiveIntOrNull(AdminDiscNumberText);
        if (!discNumber.HasValue)
        {
            ErrorMessage = "请输入有效的 Disc 编号。";
            return;
        }

        IsBusy = true;
        try
        {
            var created = await _discService.CreateDiscAsync(albumId.Value, new DiscUpsertRequest
            {
                DiscNumber = discNumber.Value,
                DiscTitle = string.IsNullOrWhiteSpace(AdminDiscTitle) ? null : AdminDiscTitle.Trim(),
            });

            await LoadAdminDiscsCoreAsync(albumId.Value);
            SelectedAdminDisc = AdminDiscs.FirstOrDefault(item => item.Id == created.Id);
            SuccessMessage = $"已创建 Disc #{created.DiscNumber}。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "创建 Disc 失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateAdminDiscAsync()
    {
        if (!IsAdmin || SelectedAdminDisc is null)
        {
            ErrorMessage = "请先选择要更新的 Disc。";
            return;
        }

        var discNumber = ParsePositiveIntOrNull(AdminDiscNumberText);
        if (!discNumber.HasValue)
        {
            ErrorMessage = "请输入有效的 Disc 编号。";
            return;
        }

        var albumId = ParsePositiveIntOrNull(AdminAlbumIdText);
        if (!albumId.HasValue)
        {
            ErrorMessage = "请输入有效的专辑 ID。";
            return;
        }

        IsBusy = true;
        try
        {
            var updated = await _discService.UpdateDiscAsync(SelectedAdminDisc.Id, new DiscUpsertRequest
            {
                DiscNumber = discNumber.Value,
                DiscTitle = string.IsNullOrWhiteSpace(AdminDiscTitle) ? null : AdminDiscTitle.Trim(),
            });

            await LoadAdminDiscsCoreAsync(albumId.Value);
            SelectedAdminDisc = AdminDiscs.FirstOrDefault(item => item.Id == updated.Id);
            SuccessMessage = $"已更新 Disc #{updated.DiscNumber}。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新 Disc 失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteAdminDiscAsync()
    {
        if (!IsAdmin || SelectedAdminDisc is null)
        {
            ErrorMessage = "请先选择要删除的 Disc。";
            return;
        }

        var albumId = ParsePositiveIntOrNull(AdminAlbumIdText);
        if (!albumId.HasValue)
        {
            ErrorMessage = "请输入有效的专辑 ID。";
            return;
        }

        IsBusy = true;
        try
        {
            await _discService.DeleteDiscAsync(SelectedAdminDisc.Id);
            await LoadAdminDiscsCoreAsync(albumId.Value);
            ClearAdminDiscForm();
            SuccessMessage = "已删除 Disc。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除 Disc 失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task AssignTrackToAdminDiscAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var trackId = ParsePositiveIntOrNull(AdminDiscTrackIdText);
        if (!trackId.HasValue)
        {
            ErrorMessage = "请输入有效的曲目 ID。";
            return;
        }

        IsBusy = true;
        try
        {
            await _discService.AssignTrackToDiscAsync(trackId.Value, SelectedAdminDisc?.Id);
            SuccessMessage = SelectedAdminDisc is null
                ? $"已将曲目 #{trackId.Value} 从 Disc 解绑。"
                : $"已将曲目 #{trackId.Value} 绑定到 Disc #{SelectedAdminDisc.DiscNumber}。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "曲目绑定 Disc 失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task PreviewAdminLyricsImportAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var filePaths = ParsePathList(AdminLyricsImportPathsText);
        if (filePaths.Count == 0)
        {
            ErrorMessage = "请先填写歌词文件路径（换行/逗号/分号分隔）。";
            return;
        }

        IsAdminLyricsImportLoading = true;
        try
        {
            var preview = await _lyricsImportService.PreviewImportAsync(filePaths);
            AdminLyricsPreviewItems.Clear();
            foreach (var item in preview.Items)
            {
                AdminLyricsPreviewItems.Add(item);
            }

            var summary = preview.Summary;
            AdminLyricsPreviewSummary = summary is null
                ? $"预览完成，共 {preview.Items.Count} 条。"
                : $"预览：总 {summary.Total}，匹配 {summary.Matched}，歧义 {summary.Ambiguous}，未命中 {summary.NotFound}，无效 {summary.Invalid}";
            SuccessMessage = "歌词导入预览完成。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "歌词导入预览失败，请稍后重试。");
        }
        finally
        {
            IsAdminLyricsImportLoading = false;
        }
    }

    [RelayCommand]
    private async Task CommitAdminLyricsImportAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        var filePaths = ParsePathList(AdminLyricsImportPathsText);
        if (filePaths.Count == 0)
        {
            ErrorMessage = "请先填写歌词文件路径（换行/逗号/分号分隔）。";
            return;
        }

        var resolutions = ParseResolutionMap(AdminLyricsResolutionsText);
        IsAdminLyricsImportLoading = true;
        try
        {
            var result = await _lyricsImportService.CommitImportAsync(filePaths, resolutions);
            AdminLyricsCommitItems.Clear();
            foreach (var item in result.Items)
            {
                AdminLyricsCommitItems.Add(item);
            }

            var summary = result.Summary;
            AdminLyricsCommitSummary = summary is null
                ? $"提交完成，共 {result.Items.Count} 条。"
                : $"提交：总 {summary.Total}，导入 {summary.Imported}，歧义 {summary.Ambiguous}，未命中 {summary.NotFound}，无效 {summary.Invalid}，错误 {summary.Error}";
            SuccessMessage = "歌词导入提交完成。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "歌词导入提交失败，请稍后重试。");
        }
        finally
        {
            IsAdminLyricsImportLoading = false;
        }
    }

    [RelayCommand]
    private async Task SendAdminMessageAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(AdminMessageTitle) || string.IsNullOrWhiteSpace(AdminMessageContent))
        {
            ErrorMessage = "请输入站内信标题和内容。";
            return;
        }

        var recipients = ParseCsvPositiveIntList(AdminMessageRecipientIdsText);
        if (!AdminMessageIsBroadcast && recipients.Count == 0)
        {
            ErrorMessage = "非广播消息需要填写至少一个用户 ID。";
            return;
        }

        DateTimeOffset? expiresAt = null;
        if (!string.IsNullOrWhiteSpace(AdminMessageExpiresAtText))
        {
            if (!DateTimeOffset.TryParse(AdminMessageExpiresAtText.Trim(), out var parsedExpiresAt))
            {
                ErrorMessage = "过期时间格式不正确，请使用可解析的日期时间文本。";
                return;
            }

            expiresAt = parsedExpiresAt;
        }

        IsBusy = true;
        try
        {
            var deliveryCount = await _messageService.SendAdminMessageAsync(
                AdminMessageTitle.Trim(),
                AdminMessageContent.Trim(),
                AdminMessageIsBroadcast,
                recipients,
                expiresAt);

            SuccessMessage = $"站内信发送成功，投递 {deliveryCount} 条。";
            AdminMessageTitle = string.Empty;
            AdminMessageContent = string.Empty;
            AdminMessageRecipientIdsText = string.Empty;
            AdminMessageExpiresAtText = string.Empty;
            await RefreshInboxAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "发送站内信失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void AddSelectedAdminUserToMessageRecipients()
    {
        if (SelectedAdminUser is null)
        {
            ErrorMessage = "请先在“用户”分区选择目标用户。";
            return;
        }

        var recipients = ParseCsvPositiveIntList(AdminMessageRecipientIdsText).ToHashSet();
        recipients.Add(SelectedAdminUser.Id);
        AdminMessageRecipientIdsText = string.Join(",", recipients.OrderBy(id => id));
        SuccessMessage = $"已加入接收用户：{SelectedAdminUser.Username}（#{SelectedAdminUser.Id}）。";
    }

    [RelayCommand]
    private void ClearAdminMessageRecipients()
    {
        AdminMessageRecipientIdsText = string.Empty;
    }

    [RelayCommand]
    private async Task RefreshDiscoverAsync()
    {
        await LoadDiscoverAsync();
    }

    [RelayCommand]
    private async Task ToggleFavoriteForDiscoverTrackAsync(PublicTrackItem? track)
    {
        var target = track ?? SelectedDiscoverTrack;
        if (target is null)
        {
            return;
        }

        var mapped = new TrackItem
        {
            Id = target.Id,
            Title = target.Title,
            AlbumTitle = target.AlbumTitle,
            Duration = target.Duration,
        };

        SelectedPublicTrack = mapped;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private void BackToDiscover()
    {
        OpenSection(SectionDiscover);
    }

    [RelayCommand]
    private void EnqueueDiscoverTrack(PublicTrackItem? track)
    {
        var target = track ?? SelectedDiscoverTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.AlbumTitle ?? string.Empty, target.Duration));
        SuccessMessage = "已加入播放队列。";
    }

    [RelayCommand]
    private void PlayDiscoverTrackNext(PublicTrackItem? track)
    {
        var target = track ?? SelectedDiscoverTrack;
        if (target is null)
        {
            return;
        }

        var item = new PlaybackQueueItem(target.Id, target.Title, target.AlbumTitle ?? string.Empty, target.Duration);
        if (_playbackQueue.Count == 0)
        {
            _playbackQueue.Add(item);
            _playbackIndex = 0;
            SyncQueueProjection();
            PlayQueueItem(item);
            return;
        }

        var insertIndex = Math.Min(_playbackQueue.Count, Math.Max(_playbackIndex + 1, 0));
        if (PreventDuplicateQueueItems && _playbackQueue.Any(queueItem => queueItem.Id == item.Id))
        {
            return;
        }

        _playbackQueue.Insert(insertIndex, item);
        SyncQueueProjection();
        SuccessMessage = "已设置为下一首播放。";
    }

    [RelayCommand]
    private async Task OpenDiscoverTrackDetailAsync(PublicTrackItem? track)
    {
        var target = track ?? SelectedDiscoverTrack;
        if (target is null)
        {
            return;
        }

        await LoadTrackDetailAsync(target.Id);
    }

    [RelayCommand]
    private void PlayDiscoverTrack(PublicTrackItem? track)
    {
        var target = track ?? SelectedDiscoverTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择发现页曲目。";
            return;
        }

        PlayFromQueue(
            RandomTracks.Select(item => new PlaybackQueueItem(item.Id, item.Title, string.Empty, item.Duration)).ToList(),
            target.Id);
    }

    [RelayCommand]
    private void PlayFilteredDiscoverTracks()
    {
        if (RandomTracksView.Count == 0 && TopTracksView.Count == 0)
        {
            ErrorMessage = "当前筛选下没有可播放曲目。";
            return;
        }

        var queue = RandomTracksView
            .Concat(TopTracksView)
            .GroupBy(item => item.Id)
            .Select(group => group.First())
            .Select(item => new PlaybackQueueItem(item.Id, item.Title, item.AlbumTitle ?? string.Empty, item.Duration))
            .ToList();
        PlayFromQueue(queue, queue[0].Id);
    }

    private async Task EnsureAdminSectionDataAsync(bool forceReload)
    {
        if (!IsAdmin || !IsAdminSection)
        {
            return;
        }

        switch (SelectedAdminSection)
        {
            case AdminSectionUsers:
                if (forceReload || AdminUsers.Count == 0)
                {
                    await LoadAdminUsersAsync(Math.Max(AdminUsersPage, 1));
                }
                break;
            case AdminSectionTags:
                if (forceReload || (AdminTags.Count == 0 && AdminTagGroups.Count == 0))
                {
                    await LoadAdminTagsAsync();
                }
                break;
            case AdminSectionGames:
                if (forceReload || Games.Count == 0)
                {
                    await LoadAdminGamesAsync();
                }
                break;
            case AdminSectionArtists:
                if (forceReload || AdminArtists.Count == 0)
                {
                    await LoadAdminArtistsAsync(Math.Max(AdminArtistsPage, 1));
                }
                break;
            case AdminSectionAnalytics:
                if (forceReload || AdminAnalyticsRecentVisits.Count == 0)
                {
                    await LoadAdminAnalyticsAsync();
                }
                break;
            case AdminSectionAlbums:
                if (forceReload)
                {
                    await LoadTracksAsync();
                    var albumId = ParsePositiveIntOrNull(AdminAlbumIdText);
                    if (albumId.HasValue)
                    {
                        await LoadAdminDiscsCoreAsync(albumId.Value);
                    }
                }
                break;
            case AdminSectionMusicSources:
                if (forceReload)
                {
                    AdminLyricsPreviewItems.Clear();
                    AdminLyricsCommitItems.Clear();
                    AdminLyricsPreviewSummary = string.Empty;
                    AdminLyricsCommitSummary = string.Empty;
                }
                break;
            case AdminSectionSettings:
                if (forceReload || string.IsNullOrWhiteSpace(AdminMaintenanceMessage) || string.IsNullOrWhiteSpace(AdminFirstVisitTitle))
                {
                    await LoadAdminMaintenanceConfigAsync();
                }

                if (forceReload || AdminFeedbackItems.Count == 0)
                {
                    await LoadAdminFeedbackAsync(Math.Max(AdminFeedbackPage, 1));
                }
                break;
        }
    }

    private async Task LoadAdminUsersAsync(int page = 1)
    {
        if (!IsAdmin)
        {
            AdminUsers.Clear();
            return;
        }

        IsAdminUsersLoading = true;
        ShowAdminUsersStatus = true;
        AdminUsersStatusMessage = "正在加载用户列表...";
        try
        {
            var result = await _userService.GetUsersAsync(
                page: Math.Max(1, page),
                pageSize: 20,
                filters: new UserListFilters
                {
                    Keyword = AdminUserKeyword,
                    Role = AdminUserRole,
                    Status = AdminUserStatus,
                    Verified = "all",
                });

            AdminUsers.Clear();
            foreach (var item in result.Items)
            {
                AdminUsers.Add(item);
            }

            AdminUsersPage = result.Pagination?.Page > 0 ? result.Pagination.Page : Math.Max(1, page);
            AdminUsersTotalPages = Math.Max(1, result.Pagination?.TotalPages ?? 1);
            AdminUsersTotal = Math.Max(0, result.Pagination?.Total ?? result.Items.Count);

            if (AdminUsers.Count == 0)
            {
                ShowAdminUsersStatus = true;
                AdminUsersStatusMessage = "没有匹配的用户。";
            }
            else
            {
                ShowAdminUsersStatus = false;
                AdminUsersStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowAdminUsersStatus = true;
            AdminUsersStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载用户列表失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载用户列表失败，请稍后重试。");
        }
        finally
        {
            IsAdminUsersLoading = false;
        }
    }

    private async Task LoadAdminTagsAsync()
    {
        if (!IsAdmin)
        {
            AdminTags.Clear();
            AdminTagGroups.Clear();
            return;
        }

        IsAdminTagsLoading = true;
        ShowAdminTagsStatus = true;
        AdminTagsStatusMessage = "正在加载标签与分组...";
        try
        {
            var tagsTask = _tagService.GetTagsAsync();
            var groupsTask = _tagService.GetTagGroupsAsync();
            var tags = await tagsTask;
            var groups = await groupsTask;

            AdminTags.Clear();
            foreach (var item in tags)
            {
                AdminTags.Add(item);
            }

            AdminTagGroups.Clear();
            foreach (var item in groups)
            {
                AdminTagGroups.Add(item);
            }

            if (SelectedAdminTag is not null)
            {
                SelectedAdminTag = AdminTags.FirstOrDefault(item => item.Id == SelectedAdminTag.Id);
            }

            if (SelectedAdminTagGroup is not null)
            {
                SelectedAdminTagGroup = AdminTagGroups.FirstOrDefault(item => item.Id == SelectedAdminTagGroup.Id);
            }

            if (SelectedAdminTagAssignGroup is not null)
            {
                SelectedAdminTagAssignGroup = AdminTagGroups.FirstOrDefault(item => item.Id == SelectedAdminTagAssignGroup.Id);
            }

            if (SelectedAdminTagParent is not null)
            {
                SelectedAdminTagParent = AdminTags.FirstOrDefault(item => item.Id == SelectedAdminTagParent.Id);
            }

            if (SelectedAdminTagGroupParent is not null)
            {
                SelectedAdminTagGroupParent = AdminTagGroups.FirstOrDefault(item => item.Id == SelectedAdminTagGroupParent.Id);
            }

            ShowAdminTagsStatus = false;
            AdminTagsStatusMessage = string.Empty;
            OnPropertyChanged(nameof(AdminAnalyticsSummary));
        }
        catch (ApiException ex)
        {
            ShowAdminTagsStatus = true;
            AdminTagsStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载标签失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载标签失败，请稍后重试。");
        }
        finally
        {
            IsAdminTagsLoading = false;
        }
    }

    private async Task LoadAdminMaintenanceConfigAsync()
    {
        if (!IsAdmin)
        {
            return;
        }

        IsBusy = true;
        try
        {
            var maintenanceTask = _siteConfigService.GetAdminMaintenanceModeAsync();
            var firstVisitTask = _siteConfigService.GetAdminFirstVisitModalAsync();
            var complianceTask = _siteConfigService.GetAdminComplianceConfigAsync();

            var maintenance = await maintenanceTask;
            var firstVisit = await firstVisitTask;
            var compliance = await complianceTask;

            AdminMaintenanceEnabled = maintenance.Enabled;
            AdminMaintenanceMessage = maintenance.Message;
            AdminMaintenanceExpectedEndTime = maintenance.ExpectedEndTime ?? string.Empty;

            AdminFirstVisitEnabled = firstVisit.Enabled;
            AdminFirstVisitTitle = firstVisit.Title;
            AdminFirstVisitContent = firstVisit.Content;
            AdminFirstVisitMinStaySecondsText = Math.Max(0, firstVisit.MinStaySeconds).ToString();
            AdminFirstVisitVersion = firstVisit.Version;

            AdminComplianceEnabled = compliance.Enabled;
            AdminComplianceIcpNumber = compliance.IcpNumber;
            AdminCompliancePublicSecurityNumber = compliance.PublicSecurityNumber;

            ShowAdminSettingsStatus = true;
            AdminSettingsStatusMessage = "已同步服务器设置。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载维护配置失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadAdminFeedbackAsync(int page)
    {
        if (!IsAdmin)
        {
            AdminFeedbackItems.Clear();
            return;
        }

        IsBusy = true;
        try
        {
            var result = await _feedbackService.GetAdminListAsync(Math.Max(1, page), 20);
            AdminFeedbackItems.Clear();
            foreach (var item in result.Items)
            {
                AdminFeedbackItems.Add(item);
            }

            AdminFeedbackPage = result.Pagination?.Page > 0 ? result.Pagination.Page : Math.Max(1, page);
            AdminFeedbackTotalPages = Math.Max(1, result.Pagination?.TotalPages ?? 1);
            AdminFeedbackTotal = Math.Max(0, result.Pagination?.Total ?? result.Items.Count);
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载反馈列表失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadAdminDiscsCoreAsync(int albumId)
    {
        IsAdminAlbumsLoading = true;
        ShowAdminAlbumsStatus = true;
        AdminAlbumsStatusMessage = "正在加载 Disc 列表...";
        try
        {
            var discs = await _discService.GetDiscsByAlbumAsync(albumId);
            AdminDiscs.Clear();
            foreach (var item in discs.OrderBy(item => item.DiscNumber))
            {
                AdminDiscs.Add(item);
            }

            ShowAdminAlbumsStatus = false;
            AdminAlbumsStatusMessage = string.Empty;
            if (SelectedAdminDisc is not null)
            {
                SelectedAdminDisc = AdminDiscs.FirstOrDefault(item => item.Id == SelectedAdminDisc.Id);
            }
        }
        catch (ApiException ex)
        {
            ShowAdminAlbumsStatus = true;
            AdminAlbumsStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载 Disc 列表失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载 Disc 列表失败，请稍后重试。");
        }
        finally
        {
            IsAdminAlbumsLoading = false;
        }
    }

    private async Task LoadDiscoverAsync()
    {
        IsDiscoverLoading = true;
        ShowDiscoverStatus = true;
        DiscoverStatusMessage = "正在加载发现内容...";
        try
        {
            var selectedGameId = SelectedGame?.Id;
            var albums = await _discoverService.GetRandomAlbumsAsync(gameId: selectedGameId);
            var randomTracks = await _discoverService.GetRandomTracksAsync(gameId: selectedGameId);
            var topTracks = await _discoverService.GetTopTracksAsync(gameId: selectedGameId);

            RandomAlbums.Clear();
            foreach (var album in albums)
            {
                RandomAlbums.Add(album);
            }

            RandomTracks.Clear();
            foreach (var track in randomTracks)
            {
                RandomTracks.Add(track);
            }

            TopTracks.Clear();
            foreach (var track in topTracks)
            {
                TopTracks.Add(track);
            }

            ApplyDiscoverFilters();
            OnPropertyChanged(nameof(DiscoverSummary));

            if (SelectedGameAlbums.Count == 0 && RandomTracks.Count == 0 && TopTracks.Count == 0)
            {
                ShowDiscoverStatus = true;
                DiscoverStatusMessage = "当前游戏暂无推荐内容。";
            }
            else
            {
                ShowDiscoverStatus = false;
                DiscoverStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowDiscoverStatus = true;
            DiscoverStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载发现页数据失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载发现页数据失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"加载发现页数据失败：{ex.Message}";
            ShowDiscoverStatus = true;
            DiscoverStatusMessage = "加载发现页数据失败，请稍后重试。";
        }
        finally
        {
            IsDiscoverLoading = false;
        }
    }

    private void ApplyDiscoverFilters()
    {
        IEnumerable<PublicTrackItem> randomQuery = RandomTracks;
        IEnumerable<PublicTrackItem> topQuery = TopTracks;

        if (!string.IsNullOrWhiteSpace(DiscoverFilterText))
        {
            var keyword = DiscoverFilterText.Trim();
            randomQuery = randomQuery.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                (item.AlbumTitle ?? string.Empty).Contains(keyword, StringComparison.OrdinalIgnoreCase));
            topQuery = topQuery.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                (item.AlbumTitle ?? string.Empty).Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        RandomTracksView.Clear();
        foreach (var item in randomQuery)
        {
            RandomTracksView.Add(item);
        }

        TopTracksView.Clear();
        foreach (var item in topQuery)
        {
            TopTracksView.Add(item);
        }
    }

    private static bool TryParseAdminIsoDateTime(string? raw, out string? isoDateTime)
    {
        isoDateTime = null;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return true;
        }

        if (!DateTimeOffset.TryParse(raw.Trim(), out var parsed))
        {
            return false;
        }

        isoDateTime = parsed.ToString("O");
        return true;
    }

}
