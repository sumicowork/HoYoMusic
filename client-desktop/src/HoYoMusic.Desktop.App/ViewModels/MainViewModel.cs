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

public partial class MainViewModel : ObservableObject
{
    private const string SectionDiscover = "discover";
    private const string SectionAlbumDetail = "album-detail";
    private const string SectionTrackDetail = "track-detail";
    private const string SectionGames = "games";
    private const string SectionAlbums = "albums";
    private const string SectionArtists = "artists";
    private const string SectionTags = "tags";
    private const string SectionSearch = "search";
    private const string SectionLibrary = "library";
    private const string SectionFavorites = "favorites";
    private const string SectionPlaylists = "playlists";
    private const string SectionProfile = "profile";
    private const string SectionSettings = "settings";
    private const string SectionDownloads = "downloads";
    private const string SectionAdmin = "admin";
    private const string AdminSectionUsers = "users";
    private const string AdminSectionTags = "tags";
    private const string AdminSectionGames = "games";
    private const string AdminSectionArtists = "artists";
    private const string AdminSectionAlbums = "albums";
    private const string AdminSectionMusicSources = "music-sources";
    private const string AdminSectionAnalytics = "analytics";
    private const string AdminSectionSettings = "settings";
    private const string PlayModeSequence = "sequence";
    private const string PlayModeLoop = "loop";
    private const string PlayModeShuffle = "shuffle";
    private const string PlayModeSingle = "single";
    private const string SortReleaseDate = "release_date";

    private readonly IAuthService _authService;
    private readonly ITrackService _trackService;
    private readonly IDiscoverService _discoverService;
    private readonly IGameService _gameService;
    private readonly IArtistService _artistService;
    private readonly IAnalyticsService _analyticsService;
    private readonly IFavoriteService _favoriteService;
    private readonly IPlaylistService _playlistService;
    private readonly IAlbumService _albumService;
    private readonly ILyricsService _lyricsService;
    private readonly ICreditsService _creditsService;
    private readonly IMusicSourceService _musicSourceService;
    private readonly IMessageService _messageService;
    private readonly IDownloadService _downloadService;
    private readonly ISiteConfigService _siteConfigService;
    private readonly IUserService _userService;
    private readonly ITagService _tagService;
    private readonly IFeedbackService _feedbackService;
    private readonly IDiscService _discService;
    private readonly ILyricsImportService _lyricsImportService;
    private readonly Random _random = new();
    private CancellationTokenSource? _inboxSearchDebounceCts;
    private CancellationTokenSource? _firstVisitCountdownCts;
    private DateTimeOffset _confirmClearQueueUntil;
    private DateTimeOffset _confirmCancelAllDownloadsUntil;
    private DateTimeOffset _confirmDeletePlaylistUntil;
    private string _activeFirstVisitVersion = "1";

    private readonly string _sessionKey = Guid.NewGuid().ToString("N");
    private readonly List<PlaybackQueueItem> _playbackQueue = [];
    private int _playbackIndex = -1;
    private bool _isInitializing;
    private bool _effectivePlayReported;
    private int? _activeTrackDurationSeconds;
    private string _activePlaySessionKey = Guid.NewGuid().ToString("N");
    private string? _pendingSectionAfterLogin;

    [ObservableProperty]
    private string _identifier = string.Empty;

    [ObservableProperty]
    private string _password = string.Empty;

    [ObservableProperty]
    private string _registerUsername = string.Empty;

    [ObservableProperty]
    private string _registerEmail = string.Empty;

    [ObservableProperty]
    private string _registerPassword = string.Empty;

    [ObservableProperty]
    private string _registerConfirmPassword = string.Empty;

    [ObservableProperty]
    private string _verificationCode = string.Empty;

    [ObservableProperty]
    private string _verificationChallengeId = string.Empty;

    [ObservableProperty]
    private string _searchKeyword = string.Empty;

    [ObservableProperty]
    private string _searchArtist = string.Empty;

    [ObservableProperty]
    private string _libraryGameIdsText = string.Empty;

    [ObservableProperty]
    private string _yearFromText = string.Empty;

    [ObservableProperty]
    private string _yearToText = string.Empty;

    [ObservableProperty]
    private string _durationMinText = string.Empty;

    [ObservableProperty]
    private string _durationMaxText = string.Empty;

    [ObservableProperty]
    private string _durationBucket = string.Empty;

    [ObservableProperty]
    private string _lyricsStatus = string.Empty;

    [ObservableProperty]
    private bool _libraryHasLyricsOnly;

    [ObservableProperty]
    private string _librarySortBy = SortReleaseDate;

    [ObservableProperty]
    private string _librarySortDir = "DESC";

    [ObservableProperty]
    private int _libraryPage = 1;

    [ObservableProperty]
    private int _libraryTotalPages = 1;

    [ObservableProperty]
    private int _libraryTotal;

    [ObservableProperty]
    private int _libraryLimit = 20;

    [ObservableProperty]
    private bool _showTrackDetailStatus;

    [ObservableProperty]
    private string _trackDetailStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isTrackDetailLoading;

    public bool ShowGlobalBusy => IsBusy && !IsLibraryLoading && !IsPlaylistsLoading && !IsFavoritesLoading && !IsDiscoverLoading && !IsTrackDetailLoading;

    [ObservableProperty]
    private TrackItem? _currentDetailTrack;

    [ObservableProperty]
    private string _detailLyrics = string.Empty;

    [ObservableProperty]
    private string _detailLyricsStatus = string.Empty;

    [ObservableProperty]
    private int _unreadMessageCount;

    [ObservableProperty]
    private bool _showInboxStatus;

    [ObservableProperty]
    private string _inboxStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isInboxLoading;

    [ObservableProperty]
    private string _favoriteSearchText = string.Empty;

    [ObservableProperty]
    private string _favoriteSortBy = "title";

    [ObservableProperty]
    private bool _favoriteSortDesc;

    [ObservableProperty]
    private string _playlistSearchText = string.Empty;

    [ObservableProperty]
    private string _playlistTrackSearchText = string.Empty;

    [ObservableProperty]
    private bool _preventDuplicateQueueItems = true;

    [ObservableProperty]
    private bool _queueAutoPlayOnAdd;

    [ObservableProperty]
    private string _queueFilterText = string.Empty;

    [ObservableProperty]
    private int _sleepTimerMinutes;

    [ObservableProperty]
    private bool _isSleepTimerEnabled;

    [ObservableProperty]
    private int _abLoopStartSeconds;

    [ObservableProperty]
    private int _abLoopEndSeconds;

    [ObservableProperty]
    private bool _isAbLoopEnabled;

    [ObservableProperty]
    private string _downloadStatusFilter = "all";

    [ObservableProperty]
    private string _downloadSearchText = string.Empty;

    [ObservableProperty]
    private bool _showUnreadOnly;

    [ObservableProperty]
    private string _messageSearchText = string.Empty;

    [ObservableProperty]
    private int _inboxPage = 1;

    [ObservableProperty]
    private int _inboxTotalPages = 1;

    [ObservableProperty]
    private int _inboxTotal;

    [ObservableProperty]
    private string _playlistEditName = string.Empty;

    [ObservableProperty]
    private string _playlistEditDescription = string.Empty;

    [ObservableProperty]
    private int _discoverRandomCount = 10;

    [ObservableProperty]
    private int _discoverTopCount = 10;

    [ObservableProperty]
    private string _discoverFilterText = string.Empty;

    [ObservableProperty]
    private bool _lyricsPreviewExpanded;

    [ObservableProperty]
    private int _lyricsFontSize = 14;

    [ObservableProperty]
    private string _newPlaylistName = string.Empty;

    [ObservableProperty]
    private string _currentPassword = string.Empty;

    [ObservableProperty]
    private string _newPassword = string.Empty;

    [ObservableProperty]
    private string _themeMode = "system";

    [ObservableProperty]
    private string _selectedAdminSection = AdminSectionUsers;

    [ObservableProperty]
    private string _adminUserKeyword = string.Empty;

    [ObservableProperty]
    private string _adminUserRole = "all";

    [ObservableProperty]
    private string _adminUserStatus = "all";

    [ObservableProperty]
    private int _adminUsersPage = 1;

    [ObservableProperty]
    private int _adminUsersTotalPages = 1;

    [ObservableProperty]
    private int _adminUsersTotal;

    [ObservableProperty]
    private int _adminArtistsPage = 1;

    [ObservableProperty]
    private int _adminArtistsTotalPages = 1;

    [ObservableProperty]
    private int _adminArtistsTotal;

    [ObservableProperty]
    private bool _isAdminUsersLoading;

    [ObservableProperty]
    private string _adminUsersStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _showAdminUsersStatus;

    [ObservableProperty]
    private AdminUserItem? _selectedAdminUser;

    [ObservableProperty]
    private bool _isAdminTagsLoading;

    [ObservableProperty]
    private string _adminTagsStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _showAdminTagsStatus;

    [ObservableProperty]
    private TagItem? _selectedAdminTag;

    [ObservableProperty]
    private TagGroupItem? _selectedAdminTagGroup;

    [ObservableProperty]
    private string _adminTagName = string.Empty;

    [ObservableProperty]
    private string _adminTagColor = "#6B9EFF";

    [ObservableProperty]
    private string _adminTagDescription = string.Empty;

    [ObservableProperty]
    private string _adminTagGroupIdText = string.Empty;

    [ObservableProperty]
    private TagGroupItem? _selectedAdminTagAssignGroup;

    [ObservableProperty]
    private string _adminTagParentIdText = string.Empty;

    [ObservableProperty]
    private TagItem? _selectedAdminTagParent;

    [ObservableProperty]
    private string _adminTagIcon = string.Empty;

    [ObservableProperty]
    private string _adminTagDisplayOrderText = string.Empty;

    [ObservableProperty]
    private string _adminTagGroupName = string.Empty;

    [ObservableProperty]
    private string _adminTagGroupDescription = string.Empty;

    [ObservableProperty]
    private string _adminTagGroupIcon = string.Empty;

    [ObservableProperty]
    private string _adminTagGroupDisplayOrderText = string.Empty;

    [ObservableProperty]
    private string _adminTagGroupParentIdText = string.Empty;

    [ObservableProperty]
    private TagGroupItem? _selectedAdminTagGroupParent;

    [ObservableProperty]
    private string _adminTestEmail = string.Empty;

    [ObservableProperty]
    private bool _adminFirstVisitEnabled;

    [ObservableProperty]
    private string _adminFirstVisitTitle = string.Empty;

    [ObservableProperty]
    private string _adminFirstVisitContent = string.Empty;

    [ObservableProperty]
    private string _adminFirstVisitMinStaySecondsText = "0";

    [ObservableProperty]
    private string _adminFirstVisitVersion = string.Empty;

    [ObservableProperty]
    private bool _adminComplianceEnabled;

    [ObservableProperty]
    private string _adminComplianceIcpNumber = string.Empty;

    [ObservableProperty]
    private string _adminCompliancePublicSecurityNumber = string.Empty;

    [ObservableProperty]
    private string _adminMessageTitle = string.Empty;

    [ObservableProperty]
    private string _adminMessageContent = string.Empty;

    [ObservableProperty]
    private bool _adminMessageIsBroadcast = true;

    [ObservableProperty]
    private string _adminMessageRecipientIdsText = string.Empty;

    [ObservableProperty]
    private string _adminMessageExpiresAtText = string.Empty;

    [ObservableProperty]
    private bool _adminMaintenanceEnabled;

    [ObservableProperty]
    private string _adminMaintenanceMessage = string.Empty;

    [ObservableProperty]
    private string _adminMaintenanceExpectedEndTime = string.Empty;

    [ObservableProperty]
    private string _adminAlbumIdText = string.Empty;

    [ObservableProperty]
    private DiscItem? _selectedAdminDisc;

    [ObservableProperty]
    private string _adminDiscNumberText = string.Empty;

    [ObservableProperty]
    private string _adminDiscTitle = string.Empty;

    [ObservableProperty]
    private string _adminDiscTrackIdText = string.Empty;

    [ObservableProperty]
    private bool _isAdminAlbumsLoading;

    [ObservableProperty]
    private string _adminAlbumsStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _showAdminAlbumsStatus;

    [ObservableProperty]
    private string _adminLyricsImportPathsText = string.Empty;

    [ObservableProperty]
    private string _adminLyricsResolutionsText = string.Empty;

    [ObservableProperty]
    private string _adminLyricsPreviewSummary = string.Empty;

    [ObservableProperty]
    private string _adminLyricsCommitSummary = string.Empty;

    [ObservableProperty]
    private bool _isAdminLyricsImportLoading;

    [ObservableProperty]
    private int _adminFeedbackPage = 1;

    [ObservableProperty]
    private int _adminFeedbackTotalPages = 1;

    [ObservableProperty]
    private int _adminFeedbackTotal;

    [ObservableProperty]
    private string _feedbackContent = string.Empty;

    [ObservableProperty]
    private string _feedbackContact = string.Empty;

    [ObservableProperty]
    private string _adminSettingsStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _showAdminSettingsStatus;

    [ObservableProperty]
    private string _selectedSection = SectionDiscover;

    [ObservableProperty]
    private int _selectedSectionIndex;

    [ObservableProperty]
    private string _activeDrawerPanel = DrawerNone;

    public const string DrawerNone = "none";
    public const string DrawerQueue = "queue";
    public const string DrawerNowPlaying = "now-playing";
    public const string DrawerEnhancements = "enhancements";
    public const string DrawerAccount = "account";
    public const string DrawerInbox = "inbox";

    public bool IsDrawerOpen => ActiveDrawerPanel != DrawerNone;
    public bool IsQueueDrawerOpen => ActiveDrawerPanel == DrawerQueue;
    public bool IsNowPlayingDrawerOpen => ActiveDrawerPanel == DrawerNowPlaying;
    public bool IsEnhancementsDrawerOpen => ActiveDrawerPanel == DrawerEnhancements;
    public bool IsAccountDrawerOpen => ActiveDrawerPanel == DrawerAccount;
    public bool IsInboxDrawerOpen => ActiveDrawerPanel == DrawerInbox;
    public bool HasPlaybackQueueInverse => _playbackQueue.Count == 0;

    [RelayCommand]
    private void OpenDrawer(string panel)
    {
        if (ActiveDrawerPanel == panel)
        {
            ActiveDrawerPanel = DrawerNone;
        }
        else
        {
            ActiveDrawerPanel = panel;
        }
    }

    [RelayCommand]
    private void CloseDrawer()
    {
        ActiveDrawerPanel = DrawerNone;
    }

    partial void OnActiveDrawerPanelChanged(string value)
    {
        OnPropertyChanged(nameof(IsDrawerOpen));
        OnPropertyChanged(nameof(IsQueueDrawerOpen));
        OnPropertyChanged(nameof(IsNowPlayingDrawerOpen));
        OnPropertyChanged(nameof(IsEnhancementsDrawerOpen));
        OnPropertyChanged(nameof(IsAccountDrawerOpen));
        OnPropertyChanged(nameof(IsInboxDrawerOpen));
    }

    [ObservableProperty]
    private bool _isBusy;

    [ObservableProperty]
    private bool _isAuthenticated;

    [ObservableProperty]
    private string _errorMessage = string.Empty;

    [ObservableProperty]
    private bool _showSuccessMessage;

    [ObservableProperty]
    private string _successMessage = string.Empty;

    [ObservableProperty]
    private string _loadingStage = "空闲";

    [ObservableProperty]
    private TrackItem? _selectedTrack;

    [ObservableProperty]
    private PublicTrackItem? _selectedDiscoverTrack;

    [ObservableProperty]
    private TrackItem? _selectedPublicTrack;

    [ObservableProperty]
    private TrackItem? _selectedFavoriteTrack;

    [ObservableProperty]
    private PlaylistItem? _selectedPlaylist;

    [ObservableProperty]
    private TrackItem? _selectedPlaylistTrack;

    [ObservableProperty]
    private string _nowPlaying = "暂无播放";

    [ObservableProperty]
    private string _currentUserDisplay = "游客";

    [ObservableProperty]
    private GameItem? _selectedGame;

    [ObservableProperty]
    private GameAlbumItem? _selectedGameAlbum;

    [ObservableProperty]
    private AlbumItem? _currentAlbum;

    [ObservableProperty]
    private TrackItem? _selectedAlbumTrack;

    [ObservableProperty]
    private AlbumTrackRow? _selectedAlbumTrackRow;

    [ObservableProperty]
    private string _playMode = PlayModeSequence;

    [ObservableProperty]
    private bool _isAdmin;

    [ObservableProperty]
    private int? _currentTrackId;

    [ObservableProperty]
    private bool _isDiscoverLoading;

    [ObservableProperty]
    private bool _showDiscoverStatus;

    [ObservableProperty]
    private string _discoverStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isLibraryLoading;

    [ObservableProperty]
    private bool _showLibraryStatus;

    [ObservableProperty]
    private string _libraryStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isFavoritesLoading;

    [ObservableProperty]
    private bool _showFavoritesStatus;

    [ObservableProperty]
    private string _favoritesStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isPlaylistsLoading;

    [ObservableProperty]
    private bool _showPlaylistsStatus;

    [ObservableProperty]
    private string _playlistsStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isAlbumLoading;

    [ObservableProperty]
    private bool _showAlbumStatus;

    [ObservableProperty]
    private string _albumStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isMaintenanceMode;

    [ObservableProperty]
    private string _maintenanceMessage = string.Empty;

    [ObservableProperty]
    private string _maintenanceExpectedEndTimeText = string.Empty;

    [ObservableProperty]
    private bool _showFirstVisitModal;

    [ObservableProperty]
    private string _firstVisitTitle = "欢迎来到 HoYoMusic";

    [ObservableProperty]
    private string _firstVisitContent = "请先阅读并确认使用须知。";

    [ObservableProperty]
    private int _firstVisitCountdownSeconds;

    [ObservableProperty]
    private bool _firstVisitAcknowledgeEnabled;

    [ObservableProperty]
    private bool _showComplianceFooter;

    [ObservableProperty]
    private string _complianceIcpNumber = string.Empty;

    [ObservableProperty]
    private string _compliancePublicSecurityNumber = string.Empty;

    [ObservableProperty]
    private string _complianceIcpUrl = "https://beian.miit.gov.cn/";

    [ObservableProperty]
    private string _compliancePublicSecurityUrl = "http://www.beian.gov.cn/portal/registerSystemInfo";

    public bool IsDiscoverSection => SelectedSection == SectionDiscover;
    public bool IsAlbumDetailSection => SelectedSection == SectionAlbumDetail;
    public bool IsGamesSection => SelectedSection == SectionGames;
    public bool IsAlbumsSection => SelectedSection == SectionAlbums;
    public bool IsArtistsSection => SelectedSection == SectionArtists;
    public bool IsTagsSection => SelectedSection == SectionTags;
    public bool IsSearchSection => SelectedSection == SectionSearch;
    public bool IsLibrarySection => SelectedSection == SectionLibrary;
    public bool IsFavoritesSection => SelectedSection == SectionFavorites;
    public bool IsPlaylistsSection => SelectedSection == SectionPlaylists;
    public bool IsProfileSection => SelectedSection == SectionProfile;
    public bool IsSettingsSection => SelectedSection == SectionSettings;
    public bool IsDownloadsSection => SelectedSection == SectionDownloads;
    public bool IsAdminSection => SelectedSection == SectionAdmin;
    public bool IsAdminUsersSection => SelectedAdminSection == AdminSectionUsers;
    public bool IsAdminTagsSection => SelectedAdminSection == AdminSectionTags;
    public bool IsAdminGamesSection => SelectedAdminSection == AdminSectionGames;
    public bool IsAdminArtistsSection => SelectedAdminSection == AdminSectionArtists;
    public bool IsAdminAlbumsSection => SelectedAdminSection == AdminSectionAlbums;
    public bool IsAdminMusicSourcesSection => SelectedAdminSection == AdminSectionMusicSources;
    public bool IsAdminAnalyticsSection => SelectedAdminSection == AdminSectionAnalytics;
    public bool IsAdminSettingsSection => SelectedAdminSection == AdminSectionSettings;
    public bool ShowMaintenanceOverlay => IsMaintenanceMode && !IsAdmin;
    public bool ShowSearchNoResults => IsSearchSection && PublicTracks.Count == 0 && !string.IsNullOrWhiteSpace(SearchKeyword);
    public bool HasRecommendedAlbums => SelectedGameAlbums.Count > 0;
    public bool HasRandomTracks => RandomTracksView.Count > 0;
    public bool HasTopTracks => TopTracksView.Count > 0;
    public bool HasPublicTracks => PublicTracks.Count > 0;
    public bool HasFavoriteTracks => FavoriteTracksView.Count > 0;
    public bool HasPlaylistTracks => PlaylistTracksView.Count > 0;
    public bool HasArtistFacets => ArtistFacetItems.Count > 0;
    public bool HasTagFacets => TagFacetItems.Count > 0;
    public bool HasRecentSearchKeywords => RecentSearchKeywords.Count > 0;
    public bool HasPlaylistsView => PlaylistsView.Count > 0;
    public bool HasDownloadTasks => DownloadTasks.Count > 0;
    public bool HasPlaybackQueue => PlaybackQueueView.Count > 0;
    public bool HasInboxMessages => InboxMessages.Count > 0;
    public string FirstVisitCountdownDisplay => FirstVisitAcknowledgeEnabled
        ? "可确认"
        : $"可确认倒计时：{FirstVisitCountdownSeconds}s";
    public string CurrentSectionTitle => SelectedSection switch
    {
        SectionDiscover => "发现",
        SectionAlbumDetail => "专辑详情",
        SectionGames => "游戏",
        SectionAlbums => "专辑",
        SectionArtists => "艺人",
        SectionTags => "标签",
        SectionSearch => "搜索",
        SectionLibrary => "曲库",
        SectionFavorites => "收藏",
        SectionPlaylists => "歌单",
        SectionProfile => "个人中心",
        SectionSettings => "设置",
        SectionDownloads => "下载中心",
        SectionAdmin => "管理",
        _ => "发现",
    };
    public string CurrentSectionSubtitle => SelectedSection switch
    {
        SectionDiscover => DiscoverSummary,
        SectionAlbumDetail => CurrentAlbum?.Title ?? "浏览专辑与曲目详情",
        SectionGames => "按游戏浏览内容入口",
        SectionAlbums => "按专辑浏览并进入详情",
        SectionArtists => "按艺人聚合并快速筛选到曲库",
        SectionTags => "按时长和歌词状态等标签筛选",
        SectionSearch => HasRecentSearchKeywords ? $"最近搜索 {RecentSearchKeywords.Count} 条" : "输入关键词快速定位曲目",
        SectionLibrary => LibraryPaginationSummary,
        SectionFavorites => IsAuthenticated ? $"收藏曲目 {FavoriteTracksView.Count} 首" : "登录后可管理收藏",
        SectionPlaylists => IsAuthenticated ? SelectedPlaylistSummary : "登录后可管理歌单",
        SectionProfile => ProfileSummary,
        SectionSettings => QueueBehaviorSummary,
        SectionDownloads => DownloadStatusSummary,
        SectionAdmin => IsAdmin ? $"管理员管理入口 · {CurrentAdminSectionLabel}" : "仅管理员可访问",
        _ => string.Empty,
    };
    public bool IsGuest => !IsAuthenticated;
    public bool ShowAdminEntry => IsAdmin;
    public bool HasErrorMessage => !string.IsNullOrWhiteSpace(ErrorMessage);
    public bool HasSelectedPlaylist => SelectedPlaylist is not null;
    public string SelectedGameSummary => SelectedGame is null
        ? "未选择游戏"
        : $"{SelectedGame.DisplayName} · {SelectedGameAlbums.Count} 张专辑";
    public string SelectedPlaylistSummary => SelectedPlaylist is null
        ? "未选择歌单"
        : $"{SelectedPlaylist.Name} · {SelectedPlaylist.TrackCount} 首 · {SelectedPlaylist.DurationDisplay}";
    public bool HasPreviousLibraryPage => LibraryPage > 1;
    public bool HasNextLibraryPage => LibraryPage < LibraryTotalPages;
    public string LibraryPaginationSummary => $"第 {LibraryPage}/{Math.Max(LibraryTotalPages, 1)} 页 · 共 {LibraryTotal} 首";
    public string UnreadMessageBadge => UnreadMessageCount > 0 ? $"消息({UnreadMessageCount})" : "消息";
    public bool HasUnreadMessages => UnreadMessageCount > 0;
    public string DownloadSummary => $"下载任务：{DownloadTasks.Count} · 过滤：{DownloadStatusFilter}";
    public string DownloadStatusSummary
    {
        get
        {
            var queued = DownloadTasks.Count(item => item.Status == DownloadStatus.Queued);
            var downloading = DownloadTasks.Count(item => item.Status == DownloadStatus.Downloading);
            var completed = DownloadTasks.Count(item => item.Status == DownloadStatus.Completed);
            var failed = DownloadTasks.Count(item => item.Status == DownloadStatus.Failed);
            return $"排队 {queued} · 下载中 {downloading} · 完成 {completed} · 失败 {failed}";
        }
    }
    public string ProfileSummary => IsAuthenticated
        ? $"{CurrentUserDisplay} · 收藏 {FavoriteTracks.Count} · 歌单 {Playlists.Count}"
        : "游客模式";
    public string InboxPaginationSummary => $"第 {InboxPage}/{Math.Max(InboxTotalPages, 1)} 页 · 共 {InboxTotal} 条";
    public string QueueBehaviorSummary => $"去重 {(PreventDuplicateQueueItems ? "开" : "关")} · 自动播 {(QueueAutoPlayOnAdd ? "开" : "关")}";
    public string SleepTimerSummary => IsSleepTimerEnabled ? $"睡眠定时：{SleepTimerMinutes} 分钟" : "睡眠定时：关闭";
    public string DiscoverSummary => $"推荐专辑 {SelectedGameAlbums.Count} · 随机曲目 {RandomTracks.Count} · 热门曲目 {TopTracks.Count}";
    public string LyricsStyleSummary => $"歌词字号：{LyricsFontSize}px";
    public string CurrentAdminSectionLabel => SelectedAdminSection switch
    {
        AdminSectionUsers => "用户管理",
        AdminSectionTags => "标签管理",
        AdminSectionGames => "游戏管理",
        AdminSectionArtists => "艺人管理",
        AdminSectionAlbums => "专辑管理",
        AdminSectionMusicSources => "音乐来源管理",
        AdminSectionAnalytics => "数据分析",
        AdminSectionSettings => "站点设置",
        _ => "用户管理",
    };
    public string AdminUsersPaginationSummary => $"第 {AdminUsersPage}/{Math.Max(AdminUsersTotalPages, 1)} 页 · 共 {AdminUsersTotal} 人";
    public bool HasPreviousAdminUsersPage => AdminUsersPage > 1;
    public bool HasNextAdminUsersPage => AdminUsersPage < AdminUsersTotalPages;
    public string AdminArtistsPaginationSummary => $"第 {AdminArtistsPage}/{Math.Max(AdminArtistsTotalPages, 1)} 页 · 共 {AdminArtistsTotal} 人";
    public bool HasPreviousAdminArtistsPage => AdminArtistsPage > 1;
    public bool HasNextAdminArtistsPage => AdminArtistsPage < AdminArtistsTotalPages;
    public string AdminAnalyticsSummary => $"7天请求 {AdminAnalyticsTotalRequests} · 今日 {AdminAnalyticsTodayRequests} · 访客 {AdminAnalyticsUniqueVisitors} · 错误 {AdminAnalyticsErrorRequests}";
    public string AdminTagSelectionSummary => SelectedAdminTag is null
        ? "未选中标签"
        : $"已选中标签 #{SelectedAdminTag.Id} · {SelectedAdminTag.Name}";
    public string AdminTagGroupSelectionSummary => SelectedAdminTagGroup is null
        ? "未选中分组"
        : $"已选中分组 #{SelectedAdminTagGroup.Id} · {SelectedAdminTagGroup.Name}";
    public string AdminFeedbackPaginationSummary => $"第 {AdminFeedbackPage}/{Math.Max(AdminFeedbackTotalPages, 1)} 页 · 共 {AdminFeedbackTotal} 条";
    public bool HasPreviousAdminFeedbackPage => AdminFeedbackPage > 1;
    public bool HasNextAdminFeedbackPage => AdminFeedbackPage < AdminFeedbackTotalPages;
    public bool HasPreviousInboxPage => InboxPage > 1;
    public bool HasNextInboxPage => InboxPage < InboxTotalPages;
    public string DetailLyricsPreview => string.IsNullOrWhiteSpace(DetailLyrics)
        ? "暂无歌词"
        : (LyricsPreviewExpanded || DetailLyrics.Length <= 220 ? DetailLyrics : $"{DetailLyrics[..220]}...");
    public string DetailCreditsSummary => DetailCredits.Count == 0
        ? "暂无制作人员信息"
        : string.Join(" | ", DetailCredits.Select(item => item.DisplayText));
    public string DetailMusicSourcesSummary => DetailMusicSources.Count == 0
        ? "暂无音乐来源信息"
        : string.Join(" | ", DetailMusicSources.Select(item => item.DisplayText));
    public string PlayModeDisplay => PlayMode switch
    {
        PlayModeLoop => "列表循环",
        PlayModeShuffle => "随机播放",
        PlayModeSingle => "单曲循环",
        _ => "顺序播放",
    };

    public ObservableCollection<TrackItem> Tracks { get; } = [];
    public ObservableCollection<RandomAlbumItem> RandomAlbums { get; } = [];
    public ObservableCollection<PublicTrackItem> RandomTracks { get; } = [];
    public ObservableCollection<PublicTrackItem> TopTracks { get; } = [];
    public ObservableCollection<PublicTrackItem> RandomTracksView { get; } = [];
    public ObservableCollection<PublicTrackItem> TopTracksView { get; } = [];
    public ObservableCollection<TrackItem> PublicTracks { get; } = [];
    public ObservableCollection<TrackItem> FavoriteTracks { get; } = [];
    public ObservableCollection<PlaylistItem> Playlists { get; } = [];
    public ObservableCollection<TrackItem> PlaylistTracks { get; } = [];
    public ObservableCollection<GameItem> Games { get; } = [];
    public ObservableCollection<GameAlbumItem> SelectedGameAlbums { get; } = [];
    public ObservableCollection<TrackItem> AlbumTracks { get; } = [];
    public ObservableCollection<AlbumTrackRow> AlbumTrackRows { get; } = [];
    public ObservableCollection<PlaybackQueueItem> PlaybackQueue { get; } = [];
    public ObservableCollection<CreditItem> DetailCredits { get; } = [];
    public ObservableCollection<TrackMusicSourceItem> DetailMusicSources { get; } = [];
    public ObservableCollection<InboxMessageItem> InboxMessages { get; } = [];
    public ObservableCollection<TrackItem> FavoriteTracksView { get; } = [];
    public ObservableCollection<TrackItem> PlaylistTracksView { get; } = [];
    public ObservableCollection<PlaylistItem> PlaylistsView { get; } = [];
    public ObservableCollection<PlaybackQueueItem> PlaybackQueueView { get; } = [];
    public ObservableCollection<DownloadTaskItem> DownloadTasks { get; } = [];
    public ObservableCollection<FacetItem> ArtistFacetItems { get; } = [];
    public ObservableCollection<FacetItem> TagFacetItems { get; } = [];
    public ObservableCollection<string> RecentSearchKeywords { get; } = [];
    public ObservableCollection<AdminUserItem> AdminUsers { get; } = [];
    public ObservableCollection<TagItem> AdminTags { get; } = [];
    public ObservableCollection<TagGroupItem> AdminTagGroups { get; } = [];
    public ObservableCollection<ArtistAdminItem> AdminArtists { get; } = [];
    public ObservableCollection<ArtistAliasItem> AdminArtistAliases { get; } = [];
    public ObservableCollection<ArtistRoleAliasItem> AdminArtistRoleAliases { get; } = [];
    public ObservableCollection<AnalyticsHourlyItem> AdminAnalyticsHourly { get; } = [];
    public ObservableCollection<AnalyticsTopPageItem> AdminAnalyticsPages { get; } = [];
    public ObservableCollection<AnalyticsStatusCodeItem> AdminAnalyticsStatusCodes { get; } = [];
    public ObservableCollection<AnalyticsRecentVisitItem> AdminAnalyticsRecentVisits { get; } = [];
    public ObservableCollection<double> SpectrumBars { get; } = new(Enumerable.Repeat(10d, 18));
    public ObservableCollection<FeedbackItem> AdminFeedbackItems { get; } = [];
    public ObservableCollection<DiscItem> AdminDiscs { get; } = [];
    public ObservableCollection<LyricsImportItem> AdminLyricsPreviewItems { get; } = [];
    public ObservableCollection<LyricsImportItem> AdminLyricsCommitItems { get; } = [];

    public sealed record FacetItem(string Label, string Value, int Count);
    public class AlbumTrackRow : ObservableObject
    {
        public int Id { get; init; }
        public string Title { get; init; } = string.Empty;
        public string ArtistsDisplay { get; init; } = string.Empty;
        public int? DurationSeconds { get; init; }

        private bool _isCurrentPlaying;
        public bool IsCurrentPlaying
        {
            get => _isCurrentPlaying;
            set
            {
                if (SetProperty(ref _isCurrentPlaying, value))
                {
                    OnPropertyChanged(nameof(PlayingIndicator));
                }
            }
        }

        public string PlayingIndicator => IsCurrentPlaying ? "▶" : string.Empty;

        public string DurationDisplay
        {
            get
            {
                if (DurationSeconds is null || DurationSeconds <= 0)
                {
                    return "--:--";
                }

                var ts = TimeSpan.FromSeconds(DurationSeconds.Value);
                return ts.TotalHours >= 1 ? ts.ToString("h\\:mm\\:ss") : ts.ToString("mm\\:ss");
            }
        }
    }


    public MainViewModel(
        IAuthService authService,
        ITrackService trackService,
        IDiscoverService discoverService,
        IGameService gameService,
        IArtistService artistService,
        IAnalyticsService analyticsService,
        IFavoriteService favoriteService,
        IPlaylistService playlistService,
        IAlbumService albumService,
        ILyricsService lyricsService,
        ICreditsService creditsService,
        IMusicSourceService musicSourceService,
        IMessageService messageService,
        IDownloadService downloadService,
        ISiteConfigService siteConfigService,
        IUserService userService,
        ITagService tagService,
        IFeedbackService feedbackService,
        IDiscService discService,
        ILyricsImportService lyricsImportService)
    {
        _authService = authService;
        _trackService = trackService;
        _discoverService = discoverService;
        _gameService = gameService;
        _artistService = artistService;
        _analyticsService = analyticsService;
        _favoriteService = favoriteService;
        _playlistService = playlistService;
        _albumService = albumService;
        _lyricsService = lyricsService;
        _creditsService = creditsService;
        _musicSourceService = musicSourceService;
        _messageService = messageService;
        _downloadService = downloadService;
        _siteConfigService = siteConfigService;
        _userService = userService;
        _tagService = tagService;
        _feedbackService = feedbackService;
        _discService = discService;
        _lyricsImportService = lyricsImportService;

        RegisterDerivedStateObservers();
    }

    private void RegisterDerivedStateObservers()
    {
        SelectedGameAlbums.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasRecommendedAlbums));
            OnPropertyChanged(nameof(SelectedGameSummary));
            OnPropertyChanged(nameof(DiscoverSummary));
        };

        RandomTracksView.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasRandomTracks));
        };

        TopTracksView.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasTopTracks));
        };

        PublicTracks.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasPublicTracks));
            OnPropertyChanged(nameof(ShowSearchNoResults));
            RefreshFacetCollections();
        };

        FavoriteTracks.CollectionChanged += (_, _) => RefreshFacetCollections();
        PlaylistTracks.CollectionChanged += (_, _) => RefreshFacetCollections();

        FavoriteTracksView.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasFavoriteTracks));
            OnPropertyChanged(nameof(ProfileSummary));
            OnPropertyChanged(nameof(CurrentSectionSubtitle));
        };

        PlaylistTracksView.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasPlaylistTracks));
        };

        ArtistFacetItems.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasArtistFacets));
        TagFacetItems.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasTagFacets));
        RecentSearchKeywords.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasRecentSearchKeywords));
            OnPropertyChanged(nameof(CurrentSectionSubtitle));
        };

        AdminTags.CollectionChanged += (_, _) => OnPropertyChanged(nameof(AdminAnalyticsSummary));
        AdminTagGroups.CollectionChanged += (_, _) => OnPropertyChanged(nameof(AdminAnalyticsSummary));
        AdminAnalyticsRecentVisits.CollectionChanged += (_, _) => OnPropertyChanged(nameof(AdminAnalyticsSummary));

        PlaylistsView.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasPlaylistsView));
        DownloadTasks.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasDownloadTasks));
        PlaybackQueueView.CollectionChanged += (_, _) =>
        {
            OnPropertyChanged(nameof(HasPlaybackQueue));
            OnPropertyChanged(nameof(HasPlaybackQueueInverse));
        };
        InboxMessages.CollectionChanged += (_, _) => OnPropertyChanged(nameof(HasInboxMessages));
    }

    private async Task HandleApiExceptionAsync(ApiException exception, string fallbackMessage)
    {
        ErrorMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(exception, fallbackMessage);

        if (HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.ShouldClearSession(exception))
        {
            await ApplyLoggedOutStateAsync(clearError: false);
        }
    }

    public event EventHandler<Uri>? PlayRequested;
    public event EventHandler? StopRequested;

    public sealed record PlaybackQueueItem(int Id, string Title, string ArtistsDisplay, int? DurationSeconds)
    {
        public string DurationDisplay
        {
            get
            {
                if (DurationSeconds is null || DurationSeconds <= 0)
                {
                    return "--:--";
                }

                var ts = TimeSpan.FromSeconds(DurationSeconds.Value);
                return ts.TotalHours >= 1 ? ts.ToString("h\\:mm\\:ss") : ts.ToString("mm\\:ss");
            }
        }
    }

    partial void OnSelectedSectionChanged(string value)
    {
        ErrorMessage = string.Empty;
        OnPropertyChanged(nameof(IsDiscoverSection));
        OnPropertyChanged(nameof(IsAlbumDetailSection));
        OnPropertyChanged(nameof(IsGamesSection));
        OnPropertyChanged(nameof(IsAlbumsSection));
        OnPropertyChanged(nameof(IsArtistsSection));
        OnPropertyChanged(nameof(IsTagsSection));
        OnPropertyChanged(nameof(IsSearchSection));
        OnPropertyChanged(nameof(ShowSearchNoResults));
        OnPropertyChanged(nameof(IsLibrarySection));
        OnPropertyChanged(nameof(IsFavoritesSection));
        OnPropertyChanged(nameof(IsPlaylistsSection));
        OnPropertyChanged(nameof(IsProfileSection));
        OnPropertyChanged(nameof(IsSettingsSection));
        OnPropertyChanged(nameof(IsDownloadsSection));
        OnPropertyChanged(nameof(IsAdminSection));
        OnPropertyChanged(nameof(CurrentSectionTitle));
        OnPropertyChanged(nameof(CurrentSectionSubtitle));

        if (value == SectionAdmin && IsAdmin)
        {
            _ = EnsureAdminSectionDataAsync(forceReload: false);
        }
    }

    partial void OnSelectedAdminSectionChanged(string value)
    {
        OnPropertyChanged(nameof(IsAdminUsersSection));
        OnPropertyChanged(nameof(IsAdminTagsSection));
        OnPropertyChanged(nameof(IsAdminGamesSection));
        OnPropertyChanged(nameof(IsAdminArtistsSection));
        OnPropertyChanged(nameof(IsAdminAlbumsSection));
        OnPropertyChanged(nameof(IsAdminMusicSourcesSection));
        OnPropertyChanged(nameof(IsAdminAnalyticsSection));
        OnPropertyChanged(nameof(IsAdminSettingsSection));
        OnPropertyChanged(nameof(CurrentAdminSectionLabel));
        OnPropertyChanged(nameof(CurrentSectionSubtitle));

        if (IsAdminSection && IsAdmin)
        {
            _ = EnsureAdminSectionDataAsync(forceReload: false);
        }
    }

    partial void OnIsAuthenticatedChanged(bool value)
    {
        OnPropertyChanged(nameof(IsGuest));
        OnPropertyChanged(nameof(ProfileSummary));
    }

    partial void OnCurrentUserDisplayChanged(string value)
    {
        OnPropertyChanged(nameof(ProfileSummary));
    }

    partial void OnErrorMessageChanged(string value)
    {
        OnPropertyChanged(nameof(HasErrorMessage));
    }

    partial void OnSuccessMessageChanged(string value)
    {
        ShowSuccessMessage = !string.IsNullOrWhiteSpace(value);
    }

    partial void OnIsAdminChanged(bool value)
    {
        OnPropertyChanged(nameof(ShowAdminEntry));
        OnPropertyChanged(nameof(ShowMaintenanceOverlay));
        OnPropertyChanged(nameof(CurrentSectionSubtitle));
    }

    partial void OnIsMaintenanceModeChanged(bool value)
    {
        OnPropertyChanged(nameof(ShowMaintenanceOverlay));
    }

    partial void OnFirstVisitCountdownSecondsChanged(int value)
    {
        OnPropertyChanged(nameof(FirstVisitCountdownDisplay));
    }

    partial void OnFirstVisitAcknowledgeEnabledChanged(bool value)
    {
        OnPropertyChanged(nameof(FirstVisitCountdownDisplay));
    }

    partial void OnPlayModeChanged(string value)
    {
        OnPropertyChanged(nameof(PlayModeDisplay));
    }

    partial void OnLibraryPageChanged(int value)
    {
        OnPropertyChanged(nameof(HasPreviousLibraryPage));
        OnPropertyChanged(nameof(HasNextLibraryPage));
        OnPropertyChanged(nameof(LibraryPaginationSummary));
    }

    partial void OnLibraryTotalPagesChanged(int value)
    {
        OnPropertyChanged(nameof(HasNextLibraryPage));
        OnPropertyChanged(nameof(LibraryPaginationSummary));
    }

    partial void OnLibraryTotalChanged(int value)
    {
        OnPropertyChanged(nameof(LibraryPaginationSummary));
    }

    partial void OnAdminUsersPageChanged(int value)
    {
        OnPropertyChanged(nameof(AdminUsersPaginationSummary));
        OnPropertyChanged(nameof(HasPreviousAdminUsersPage));
        OnPropertyChanged(nameof(HasNextAdminUsersPage));
    }

    partial void OnAdminUsersTotalPagesChanged(int value)
    {
        OnPropertyChanged(nameof(AdminUsersPaginationSummary));
        OnPropertyChanged(nameof(HasNextAdminUsersPage));
    }

    partial void OnAdminUsersTotalChanged(int value)
    {
        OnPropertyChanged(nameof(AdminUsersPaginationSummary));
        OnPropertyChanged(nameof(AdminAnalyticsSummary));
    }

    partial void OnAdminArtistsPageChanged(int value)
    {
        OnPropertyChanged(nameof(AdminArtistsPaginationSummary));
        OnPropertyChanged(nameof(HasPreviousAdminArtistsPage));
        OnPropertyChanged(nameof(HasNextAdminArtistsPage));
    }

    partial void OnAdminArtistsTotalPagesChanged(int value)
    {
        OnPropertyChanged(nameof(AdminArtistsPaginationSummary));
        OnPropertyChanged(nameof(HasNextAdminArtistsPage));
    }

    partial void OnAdminArtistsTotalChanged(int value)
    {
        OnPropertyChanged(nameof(AdminArtistsPaginationSummary));
    }

    partial void OnAdminFeedbackPageChanged(int value)
    {
        OnPropertyChanged(nameof(AdminFeedbackPaginationSummary));
        OnPropertyChanged(nameof(HasPreviousAdminFeedbackPage));
        OnPropertyChanged(nameof(HasNextAdminFeedbackPage));
    }

    partial void OnAdminFeedbackTotalPagesChanged(int value)
    {
        OnPropertyChanged(nameof(AdminFeedbackPaginationSummary));
        OnPropertyChanged(nameof(HasNextAdminFeedbackPage));
    }

    partial void OnAdminFeedbackTotalChanged(int value)
    {
        OnPropertyChanged(nameof(AdminFeedbackPaginationSummary));
    }

    partial void OnUnreadMessageCountChanged(int value)
    {
        OnPropertyChanged(nameof(UnreadMessageBadge));
        OnPropertyChanged(nameof(HasUnreadMessages));
    }

    partial void OnDetailLyricsChanged(string value)
    {
        OnPropertyChanged(nameof(DetailLyricsPreview));
    }

    partial void OnDownloadStatusFilterChanged(string value)
    {
        RefreshDownloadTasks();
        OnPropertyChanged(nameof(DownloadSummary));
        OnPropertyChanged(nameof(DownloadStatusSummary));
    }

    partial void OnDownloadSearchTextChanged(string value)
    {
        RefreshDownloadTasks();
    }

    partial void OnInboxPageChanged(int value)
    {
        OnPropertyChanged(nameof(InboxPaginationSummary));
        OnPropertyChanged(nameof(HasPreviousInboxPage));
        OnPropertyChanged(nameof(HasNextInboxPage));
    }

    partial void OnInboxTotalPagesChanged(int value)
    {
        OnPropertyChanged(nameof(InboxPaginationSummary));
        OnPropertyChanged(nameof(HasNextInboxPage));
    }

    partial void OnInboxTotalChanged(int value)
    {
        OnPropertyChanged(nameof(InboxPaginationSummary));
    }

    partial void OnFavoriteSearchTextChanged(string value)
    {
        ApplyFavoriteFilters();
    }

    partial void OnFavoriteSortByChanged(string value)
    {
        ApplyFavoriteFilters();
    }

    partial void OnFavoriteSortDescChanged(bool value)
    {
        ApplyFavoriteFilters();
    }

    partial void OnPlaylistSearchTextChanged(string value)
    {
        ApplyPlaylistFilters();
    }

    partial void OnPlaylistTrackSearchTextChanged(string value)
    {
        ApplyPlaylistTrackFilters();
    }

    partial void OnQueueFilterTextChanged(string value)
    {
        ApplyQueueFilters();
    }

    partial void OnPreventDuplicateQueueItemsChanged(bool value)
    {
        OnPropertyChanged(nameof(QueueBehaviorSummary));
    }

    partial void OnQueueAutoPlayOnAddChanged(bool value)
    {
        OnPropertyChanged(nameof(QueueBehaviorSummary));
    }

    partial void OnShowUnreadOnlyChanged(bool value)
    {
        _ = LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
    }

    partial void OnMessageSearchTextChanged(string value)
    {
        DebounceInboxReload();
    }

    partial void OnSleepTimerMinutesChanged(int value)
    {
        OnPropertyChanged(nameof(SleepTimerSummary));
    }

    partial void OnIsSleepTimerEnabledChanged(bool value)
    {
        OnPropertyChanged(nameof(SleepTimerSummary));
    }

    partial void OnLyricsPreviewExpandedChanged(bool value)
    {
        OnPropertyChanged(nameof(DetailLyricsPreview));
    }

    partial void OnLyricsFontSizeChanged(int value)
    {
        OnPropertyChanged(nameof(LyricsStyleSummary));
    }

    partial void OnDiscoverFilterTextChanged(string value)
    {
        ApplyDiscoverFilters();
    }

    partial void OnSearchKeywordChanged(string value)
    {
        OnPropertyChanged(nameof(ShowSearchNoResults));
    }

    partial void OnAdminUserKeywordChanged(string value)
    {
        _ = LoadAdminUsersAsync(1);
    }

    partial void OnAdminUserRoleChanged(string value)
    {
        _ = LoadAdminUsersAsync(1);
    }

    partial void OnAdminUserStatusChanged(string value)
    {
        _ = LoadAdminUsersAsync(1);
    }

    partial void OnSelectedAdminTagChanged(TagItem? value)
    {
        OnPropertyChanged(nameof(AdminTagSelectionSummary));

        if (value is null)
        {
            return;
        }

        AdminTagName = value.Name;
        AdminTagColor = string.IsNullOrWhiteSpace(value.Color) ? "#6B9EFF" : value.Color;
        AdminTagDescription = value.Description ?? string.Empty;
        AdminTagGroupIdText = value.GroupId?.ToString() ?? string.Empty;
        AdminTagParentIdText = value.ParentId?.ToString() ?? string.Empty;
        AdminTagIcon = value.Icon ?? string.Empty;
        AdminTagDisplayOrderText = value.DisplayOrder?.ToString() ?? string.Empty;
        SelectedAdminTagAssignGroup = value.GroupId.HasValue
            ? AdminTagGroups.FirstOrDefault(item => item.Id == value.GroupId.Value)
            : null;
        SelectedAdminTagParent = value.ParentId.HasValue
            ? AdminTags.FirstOrDefault(item => item.Id == value.ParentId.Value)
            : null;
    }

    partial void OnSelectedAdminTagGroupChanged(TagGroupItem? value)
    {
        OnPropertyChanged(nameof(AdminTagGroupSelectionSummary));

        if (value is null)
        {
            return;
        }

        AdminTagGroupName = value.Name;
        AdminTagGroupDescription = value.Description ?? string.Empty;
        AdminTagGroupIcon = value.Icon ?? string.Empty;
        AdminTagGroupDisplayOrderText = value.DisplayOrder.ToString();
        AdminTagGroupParentIdText = value.ParentGroupId?.ToString() ?? string.Empty;
        SelectedAdminTagGroupParent = value.ParentGroupId.HasValue
            ? AdminTagGroups.FirstOrDefault(item => item.Id == value.ParentGroupId.Value)
            : null;
    }

    partial void OnSelectedAdminTagAssignGroupChanged(TagGroupItem? value)
    {
        AdminTagGroupIdText = value?.Id.ToString() ?? string.Empty;
    }

    partial void OnSelectedAdminTagParentChanged(TagItem? value)
    {
        AdminTagParentIdText = value?.Id.ToString() ?? string.Empty;
    }

    partial void OnSelectedAdminTagGroupParentChanged(TagGroupItem? value)
    {
        AdminTagGroupParentIdText = value?.Id.ToString() ?? string.Empty;
    }

    partial void OnSelectedAdminDiscChanged(DiscItem? value)
    {
        if (value is null)
        {
            return;
        }

        AdminDiscNumberText = value.DiscNumber.ToString();
        AdminDiscTitle = value.DiscTitle ?? string.Empty;
    }

    partial void OnLibraryHasLyricsOnlyChanged(bool value)
    {
        _ = LoadPublicTracksAsync(Math.Max(LibraryPage, 1));
    }

    partial void OnSelectedTrackChanged(TrackItem? value)
    {
        if (value is null)
        {
            return;
        }

        ErrorMessage = string.Empty;
        NowPlaying = $"已选中：{value.Title} - {value.ArtistsDisplay}（{value.DurationDisplay}）";
        _ = LoadTrackDetailAsync(value.Id);
    }

    partial void OnSelectedDiscoverTrackChanged(PublicTrackItem? value)
    {
        if (value is null)
        {
            return;
        }

        ErrorMessage = string.Empty;
        NowPlaying = $"发现：{value.Title}（{value.DurationDisplay}）";
        _ = LoadTrackDetailAsync(value.Id);
    }

    partial void OnSelectedPublicTrackChanged(TrackItem? value)
    {
        if (value is null)
        {
            return;
        }

        ErrorMessage = string.Empty;
        NowPlaying = $"曲库：{value.Title} - {value.ArtistsDisplay}（{value.DurationDisplay}）";
        _ = LoadTrackDetailAsync(value.Id);
    }

    partial void OnSelectedFavoriteTrackChanged(TrackItem? value)
    {
        if (value is null)
        {
            return;
        }

        ErrorMessage = string.Empty;
        NowPlaying = $"收藏：{value.Title} - {value.ArtistsDisplay}（{value.DurationDisplay}）";
        _ = LoadTrackDetailAsync(value.Id);
    }

    partial void OnSelectedPlaylistChanged(PlaylistItem? value)
    {
        OnPropertyChanged(nameof(HasSelectedPlaylist));
        OnPropertyChanged(nameof(SelectedPlaylistSummary));

        if (value is null)
        {
            PlaylistTracks.Clear();
            PlaylistEditName = string.Empty;
            PlaylistEditDescription = string.Empty;
            return;
        }

        PlaylistEditName = value.Name;
        PlaylistEditDescription = value.Description ?? string.Empty;

        _ = LoadPlaylistDetailAsync(value.Id);
    }

    partial void OnSelectedGameChanged(GameItem? value)
    {
        OnPropertyChanged(nameof(SelectedGameSummary));

        if (_isInitializing || value is null)
        {
            return;
        }

        _ = ApplySelectedGameAsync();
    }

    partial void OnSelectedGameAlbumChanged(GameAlbumItem? value)
    {
        if (value is null)
        {
            CurrentAlbum = null;
            AlbumTracks.Clear();
            AlbumTrackRows.Clear();
        }
    }

    partial void OnSelectedAlbumTrackRowChanged(AlbumTrackRow? value)
    {
        if (value is null)
        {
            SelectedAlbumTrack = null;
            return;
        }

        SelectedAlbumTrack = AlbumTracks.FirstOrDefault(item => item.Id == value.Id);
        _ = LoadTrackDetailAsync(value.Id);
    }







    partial void OnSelectedSectionIndexChanged(int value)
    {
        var requestedSection = value switch
        {
            0 => SectionDiscover,
            1 => SectionGames,
            2 => SectionAlbums,
            3 => SectionArtists,
            4 => SectionTags,
            5 => SectionSearch,
            6 => SectionLibrary,
            7 => SectionFavorites,
            8 => SectionPlaylists,
            9 => SectionProfile,
            10 => SectionSettings,
            11 => SectionDownloads,
            12 => SectionAdmin,
            _ => SectionDiscover,
        };

        if (!IsAuthenticated && IsRestrictedSection(requestedSection))
        {
            RememberPendingSection(requestedSection);
            ErrorMessage = "请先登录后再访问收藏和歌单。";
            requestedSection = SectionLibrary;
            value = 6;
        }

        if (requestedSection == SectionAdmin && !IsAdmin)
        {
            RememberPendingSection(SectionAdmin);
            ErrorMessage = "仅管理员可访问管理页面。";
            requestedSection = SectionDiscover;
            value = 0;
        }

        if (SelectedSection != requestedSection)
        {
            SelectedSection = requestedSection;
        }

        if (SelectedSectionIndex != value)
        {
            SelectedSectionIndex = value;
        }
    }

























































































































































































    private IReadOnlyCollection<int>? GetSelectedGameIds()
    {
        return SelectedGame is null ? null : [SelectedGame.Id];
    }

    private IReadOnlyCollection<int>? ParseGameIdsOrDefault()
    {
        if (string.IsNullOrWhiteSpace(LibraryGameIdsText))
        {
            return GetSelectedGameIds();
        }

        var parsed = LibraryGameIdsText
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(ParsePositiveIntOrNull)
            .Where(item => item.HasValue)
            .Select(item => item!.Value)
            .Distinct()
            .ToArray();

        return parsed.Length == 0 ? GetSelectedGameIds() : parsed;
    }






























    private static IReadOnlyList<int> ParseCsvPositiveIntList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<int>();
        }

        return raw
            .Split([',', ';', ' ', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(value => int.TryParse(value, out var parsed) ? parsed : 0)
            .Where(value => value > 0)
            .Distinct()
            .ToArray();
    }

    private static IReadOnlyList<string> ParsePathList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return Array.Empty<string>();
        }

        return raw
            .Split(['\n', '\r', ';', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static IReadOnlyDictionary<string, int> ParseResolutionMap(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        }

        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var lines = raw.Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var line in lines)
        {
            var separators = new[] { '=', ':', '\t' };
            var splitIndex = line.IndexOfAny(separators);
            if (splitIndex <= 0 || splitIndex >= line.Length - 1)
            {
                continue;
            }

            var key = line[..splitIndex].Trim();
            var valueRaw = line[(splitIndex + 1)..].Trim();
            if (string.IsNullOrWhiteSpace(key) || !int.TryParse(valueRaw, out var trackId) || trackId <= 0)
            {
                continue;
            }

            map[key] = trackId;
        }

        return map;
    }
}
