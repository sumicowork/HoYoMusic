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
    public bool HasRecommendedAlbums => SelectedGameAlbums.Count > 0;
    public bool HasRandomTracks => RandomTracksView.Count > 0;
    public bool HasTopTracks => TopTracksView.Count > 0;
    public bool HasPublicTracks => PublicTracks.Count > 0;
    public bool HasFavoriteTracks => FavoriteTracksView.Count > 0;
    public bool HasPlaylistTracks => PlaylistTracksView.Count > 0;
    public bool HasArtistFacets => ArtistFacetItems.Count > 0;
    public bool HasTagFacets => TagFacetItems.Count > 0;
    public bool HasRecentSearchKeywords => RecentSearchKeywords.Count > 0;
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
    public string AdminAnalyticsSummary => $"用户 {AdminUsersTotal} · 标签 {AdminTags.Count} · 分组 {AdminTagGroups.Count} · 曲目 {Tracks.Count}";
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
        OnPropertyChanged(nameof(IsDiscoverSection));
        OnPropertyChanged(nameof(IsAlbumDetailSection));
        OnPropertyChanged(nameof(IsGamesSection));
        OnPropertyChanged(nameof(IsAlbumsSection));
        OnPropertyChanged(nameof(IsArtistsSection));
        OnPropertyChanged(nameof(IsTagsSection));
        OnPropertyChanged(nameof(IsSearchSection));
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

    [RelayCommand]
    private async Task InitializeAsync()
    {
        IsBusy = true;
        ErrorMessage = string.Empty;
        _isInitializing = true;

        try
        {
            LoadingStage = "恢复会话";
            var token = await _authService.GetSavedTokenAsync();
            IsAuthenticated = !string.IsNullOrWhiteSpace(token);
            if (IsAuthenticated)
            {
                LoadingStage = "加载账户数据";
                var user = await _authService.GetCurrentUserAsync();
                CurrentUserDisplay = user?.Username ?? "已登录";
                IsAdmin = user?.IsAdmin == true;
                await LoadTracksAsync();
                await LoadFavoritesAsync();
                await LoadPlaylistsAsync();
                await RefreshInboxAsync();
            }
            else
            {
                CurrentUserDisplay = "游客";
                IsAdmin = false;
            }

            LoadingStage = "加载游戏与发现";
            await LoadSiteConfigAsync();
            await LoadGamesAsync();
            await LoadSelectedGameAlbumsAsync();
            await LoadDiscoverAsync();
            await LoadPublicTracksAsync();
            RefreshDownloadTasks();
            LoadingStage = "完成";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "初始化失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"初始化失败：{ex.Message}";
        }
        finally
        {
            _isInitializing = false;
            IsBusy = false;
            if (LoadingStage != "完成")
            {
                LoadingStage = "空闲";
            }
        }
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Identifier) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "请输入账号和密码。";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;

        try
        {
            await _authService.LoginAsync(new LoginRequest
            {
                Identifier = Identifier.Trim(),
                Password = Password,
            });

            var user = await _authService.GetCurrentUserAsync();

            Password = string.Empty;
            IsAuthenticated = true;
            CurrentUserDisplay = user?.Username ?? Identifier;
            IsAdmin = user?.IsAdmin == true;
            await LoadTracksAsync();
            await LoadFavoritesAsync();
            await LoadPlaylistsAsync();
            await RefreshInboxAsync();
            await TryRestorePendingSectionAfterLoginAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "登录失败，请检查账号密码后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"登录失败：{ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SendVerificationCodeAsync()
    {
        if (string.IsNullOrWhiteSpace(RegisterEmail))
        {
            ErrorMessage = "请输入注册邮箱。";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            VerificationChallengeId = await _authService.SendRegistrationVerificationCodeAsync(new SendVerificationCodeRequest
            {
                Email = RegisterEmail.Trim(),
            }) ?? string.Empty;

            ErrorMessage = string.IsNullOrWhiteSpace(VerificationChallengeId)
                ? "验证码请求已提交，请检查邮箱。"
                : "验证码已发送，请在 10 分钟内完成注册。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "发送验证码失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RegisterAsync()
    {
        if (string.IsNullOrWhiteSpace(RegisterUsername) || string.IsNullOrWhiteSpace(RegisterEmail))
        {
            ErrorMessage = "请输入用户名和邮箱。";
            return;
        }

        if (string.IsNullOrWhiteSpace(RegisterPassword) || RegisterPassword.Length < 6)
        {
            ErrorMessage = "注册密码至少 6 位。";
            return;
        }

        if (string.IsNullOrWhiteSpace(VerificationChallengeId) || string.IsNullOrWhiteSpace(VerificationCode))
        {
            ErrorMessage = "请先获取并填写邮箱验证码。";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            var session = await _authService.RegisterAsync(new RegisterRequest
            {
                Username = RegisterUsername.Trim(),
                Email = RegisterEmail.Trim(),
                VerificationChallengeId = VerificationChallengeId.Trim(),
                VerificationCode = VerificationCode.Trim(),
                Password = RegisterPassword,
                ConfirmPassword = RegisterConfirmPassword,
            });

            RegisterUsername = string.Empty;
            RegisterEmail = string.Empty;
            RegisterPassword = string.Empty;
            RegisterConfirmPassword = string.Empty;
            VerificationCode = string.Empty;
            VerificationChallengeId = string.Empty;

            IsAuthenticated = true;
            CurrentUserDisplay = session.User?.Username ?? "已登录";
            IsAdmin = session.User?.IsAdmin == true;
            await LoadTracksAsync();
            await LoadFavoritesAsync();
            await LoadPlaylistsAsync();
            await RefreshInboxAsync();
            await TryRestorePendingSectionAfterLoginAsync();
            ErrorMessage = "注册成功，已自动登录。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "注册失败，请检查信息后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void OpenSection(string? section)
    {
        var requestedSection = section switch
        {
            SectionDiscover => SectionDiscover,
            SectionAlbumDetail => SectionAlbumDetail,
            SectionGames => SectionGames,
            SectionAlbums => SectionAlbums,
            SectionArtists => SectionArtists,
            SectionTags => SectionTags,
            SectionSearch => SectionSearch,
            SectionLibrary => SectionLibrary,
            SectionFavorites => SectionFavorites,
            SectionPlaylists => SectionPlaylists,
            SectionProfile => SectionProfile,
            SectionSettings => SectionSettings,
            SectionDownloads => SectionDownloads,
            SectionAdmin => SectionAdmin,
            _ => SectionDiscover,
        };

        if (!IsAuthenticated && IsRestrictedSection(requestedSection))
        {
            RememberPendingSection(requestedSection);
            ErrorMessage = "请先登录后再访问收藏和歌单。";
            requestedSection = SectionLibrary;
        }

        if (requestedSection == SectionAdmin && !IsAdmin)
        {
            RememberPendingSection(SectionAdmin);
            ErrorMessage = "仅管理员可访问管理页面。";
            requestedSection = SectionDiscover;
        }

        SelectedSection = requestedSection;
        SelectedSectionIndex = SectionToIndex(SelectedSection);

        if (requestedSection == SectionAdmin && IsAdmin)
        {
            _ = EnsureAdminSectionDataAsync(forceReload: false);
        }
    }

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

    private static bool IsRestrictedSection(string section)
    {
        return section is SectionFavorites or SectionPlaylists or SectionProfile or SectionDownloads;
    }

    private static int SectionToIndex(string section)
    {
        return section switch
        {
            SectionDiscover => 0,
            SectionAlbumDetail => 0,
            SectionGames => 1,
            SectionAlbums => 2,
            SectionArtists => 3,
            SectionTags => 4,
            SectionSearch => 5,
            SectionLibrary => 6,
            SectionFavorites => 7,
            SectionPlaylists => 8,
            SectionProfile => 9,
            SectionSettings => 10,
            SectionDownloads => 11,
            SectionAdmin => 12,
            _ => 0,
        };
    }

    [RelayCommand]
    private async Task OpenSearchCenterAsync()
    {
        OpenSection(SectionSearch);

        var keyword = SearchKeyword.Trim();
        if (string.IsNullOrWhiteSpace(keyword))
        {
            ErrorMessage = "请输入搜索关键词。";
            return;
        }

        PushRecentSearchKeyword(keyword);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, keyword);
    }

    [RelayCommand]
    private async Task ApplyArtistFacetAsync(FacetItem? facet)
    {
        if (facet is null)
        {
            return;
        }

        SearchArtist = facet.Value;
        OpenSection(SectionLibrary);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1);
    }

    [RelayCommand]
    private async Task ApplyTagFacetAsync(FacetItem? facet)
    {
        if (facet is null)
        {
            return;
        }

        if (facet.Value.StartsWith("duration:", StringComparison.OrdinalIgnoreCase))
        {
            DurationBucket = facet.Value["duration:".Length..];
        }
        else if (facet.Value.StartsWith("lyrics:", StringComparison.OrdinalIgnoreCase))
        {
            LyricsStatus = facet.Value["lyrics:".Length..];
        }

        OpenSection(SectionLibrary);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1);
    }

    [RelayCommand]
    private async Task ApplyRecentSearchKeywordAsync(string? keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
        {
            return;
        }

        SearchKeyword = keyword;
        await OpenSearchCenterAsync();
    }

    [RelayCommand]
    private void ClearRecentSearchKeywords()
    {
        RecentSearchKeywords.Clear();
    }

    [RelayCommand]
    private void AcknowledgeFirstVisit()
    {
        if (!FirstVisitAcknowledgeEnabled)
        {
            return;
        }

        var ackKey = $"first_visit_ack_{_activeFirstVisitVersion}";
        TrySetLocalSetting(ackKey, true);
        ShowFirstVisitModal = false;
        FirstVisitAcknowledgeEnabled = false;
        _firstVisitCountdownCts?.Cancel();
    }

    [RelayCommand]
    private async Task OpenComplianceLinkAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            await Launcher.LaunchUriAsync(new Uri(url));
        }
        catch (Exception ex)
        {
            ErrorMessage = $"打开链接失败：{ex.Message}";
        }
    }

    [RelayCommand]
    private async Task RefreshTracksAsync()
    {
        await LoadTracksAsync();
    }

    [RelayCommand]
    private async Task RefreshGamesAsync()
    {
        await LoadGamesAsync();
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
    private async Task SubmitFeedbackAsync()
    {
        if (string.IsNullOrWhiteSpace(FeedbackContent))
        {
            ErrorMessage = "请输入反馈内容。";
            return;
        }

        IsBusy = true;
        try
        {
            await _feedbackService.SubmitAsync(FeedbackContent.Trim(), string.IsNullOrWhiteSpace(FeedbackContact) ? null : FeedbackContact.Trim());
            FeedbackContent = string.Empty;
            FeedbackContact = string.Empty;
            SuccessMessage = "反馈已提交，感谢你的建议。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "提交反馈失败，请稍后重试。");
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
    private async Task RefreshRandomTracksAsync()
    {
        if (SelectedGame is null)
        {
            return;
        }

        try
        {
            var randomTracks = await _discoverService.GetRandomTracksAsync(Math.Clamp(DiscoverRandomCount, 5, 30), SelectedGame.Id);
            RandomTracks.Clear();
            foreach (var track in randomTracks)
            {
                RandomTracks.Add(track);
            }
            ApplyDiscoverFilters();
            OnPropertyChanged(nameof(DiscoverSummary));
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "刷新随机推荐失败，请稍后重试。");
        }
    }

    [RelayCommand]
    private async Task RefreshTopTracksAsync()
    {
        if (SelectedGame is null)
        {
            return;
        }

        try
        {
            var topTracks = await _discoverService.GetTopTracksAsync(Math.Clamp(DiscoverTopCount, 5, 100), SelectedGame.Id);
            TopTracks.Clear();
            foreach (var track in topTracks)
            {
                TopTracks.Add(track);
            }
            ApplyDiscoverFilters();
            OnPropertyChanged(nameof(DiscoverSummary));
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "刷新热门曲目失败，请稍后重试。");
        }
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
    private async Task OpenAlbumDetailAsync(GameAlbumItem? album)
    {
        var target = album ?? SelectedGameAlbum;
        if (target is null)
        {
            return;
        }

        SelectedGameAlbum = target;
        await LoadSelectedAlbumAsync(target.Id);
        OpenSection(SectionAlbumDetail);
    }

    [RelayCommand]
    private void BackToDiscover()
    {
        OpenSection(SectionDiscover);
    }

    [RelayCommand]
    private async Task RefreshPublicLibraryAsync()
    {
        await LoadPublicTracksAsync(Math.Max(LibraryPage, 1));
    }

    [RelayCommand]
    private async Task SearchPublicTracksAsync()
    {
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, SearchKeyword);
    }

    [RelayCommand]
    private async Task PreviousLibraryPageAsync()
    {
        if (!HasPreviousLibraryPage)
        {
            return;
        }

        LibraryPage = Math.Max(1, LibraryPage - 1);
        await LoadPublicTracksAsync(LibraryPage);
    }

    [RelayCommand]
    private async Task NextLibraryPageAsync()
    {
        if (!HasNextLibraryPage)
        {
            return;
        }

        LibraryPage += 1;
        await LoadPublicTracksAsync(LibraryPage);
    }

    [RelayCommand]
    private async Task ResetLibraryFiltersAsync()
    {
        SearchKeyword = string.Empty;
        SearchArtist = string.Empty;
        LibraryGameIdsText = string.Empty;
        YearFromText = string.Empty;
        YearToText = string.Empty;
        DurationMinText = string.Empty;
        DurationMaxText = string.Empty;
        DurationBucket = string.Empty;
        LyricsStatus = string.Empty;
        LibraryHasLyricsOnly = false;
        LibrarySortBy = SortReleaseDate;
        LibrarySortDir = "DESC";
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, null);
    }

    [RelayCommand]
    private void ToggleFavoriteSortDirection()
    {
        FavoriteSortDesc = !FavoriteSortDesc;
    }

    [RelayCommand]
    private async Task BatchAddFilteredFavoritesToPlaylistAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录。";
            return;
        }

        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择目标歌单。";
            return;
        }

        var targets = FavoriteTracksView.ToList();
        if (targets.Count == 0)
        {
            ErrorMessage = "当前筛选没有收藏曲目。";
            return;
        }

        IsBusy = true;
        var successCount = 0;
        foreach (var track in targets)
        {
            try
            {
                await _playlistService.AddTrackAsync(SelectedPlaylist.Id, track.Id);
                successCount++;
            }
            catch
            {
                // Keep best-effort batch behavior.
            }
        }

        await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
        IsBusy = false;
        SuccessMessage = $"已批量添加 {successCount}/{targets.Count} 首收藏曲目到歌单。";
    }

    [RelayCommand]
    private async Task BatchUnfavoriteFilteredAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录。";
            return;
        }

        var targets = FavoriteTracksView.ToList();
        if (targets.Count == 0)
        {
            ErrorMessage = "当前筛选没有收藏曲目。";
            return;
        }

        IsBusy = true;
        foreach (var track in targets)
        {
            try
            {
                await _favoriteService.ToggleAsync(track.Id);
            }
            catch
            {
                // Keep best-effort batch behavior.
            }
        }

        await LoadFavoritesAsync();
        IsBusy = false;
        SuccessMessage = "已批量取消当前筛选收藏。";
    }

    [RelayCommand]
    private void EnqueuePublicTrack(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration));
        SuccessMessage = "已加入播放队列。";
    }

    [RelayCommand]
    private void EnqueueFavoriteTrack(TrackItem? track)
    {
        var target = track ?? SelectedFavoriteTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration));
        SuccessMessage = "已加入播放队列。";
    }

    [RelayCommand]
    private void EnqueuePlaylistTrack(TrackItem? track)
    {
        var target = track ?? SelectedPlaylistTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration));
        SuccessMessage = "已加入播放队列。";
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
    private void PlayNowNextInQueue(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            return;
        }

        var item = new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration);
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
    private void RefreshDownloadCenter()
    {
        RefreshDownloadTasks();
    }

    [RelayCommand]
    private void DownloadPublicTrack(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            return;
        }

        _downloadService.Enqueue(target.Id, target.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void DownloadFavoriteTrack(TrackItem? track)
    {
        var target = track ?? SelectedFavoriteTrack;
        if (target is null)
        {
            return;
        }

        _downloadService.Enqueue(target.Id, target.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void DownloadPlaylistTrack(TrackItem? track)
    {
        var target = track ?? SelectedPlaylistTrack;
        if (target is null)
        {
            return;
        }

        _downloadService.Enqueue(target.Id, target.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void CancelDownload(Guid taskId)
    {
        if (_downloadService.Cancel(taskId))
        {
            RefreshDownloadTasks();
            SuccessMessage = "下载任务已取消。";
        }
    }

    [RelayCommand]
    private void CancelAllDownloads()
    {
        if (DateTimeOffset.Now > _confirmCancelAllDownloadsUntil)
        {
            _confirmCancelAllDownloadsUntil = DateTimeOffset.Now.AddSeconds(4);
            ErrorMessage = "再次点击“全部取消”以确认操作。";
            return;
        }

        foreach (var task in _downloadService.GetTasks())
        {
            _downloadService.Cancel(task.Id);
        }

        _confirmCancelAllDownloadsUntil = DateTimeOffset.MinValue;
        RefreshDownloadTasks();
        SuccessMessage = "已取消所有下载任务。";
    }

    [RelayCommand]
    private void ClearCompletedDownloads()
    {
        var removed = _downloadService.ClearCompleted();
        RefreshDownloadTasks();
        SuccessMessage = removed > 0 ? $"已清理 {removed} 条下载记录。" : "暂无可清理的已完成/已取消任务。";
    }

    [RelayCommand]
    private void CopyDownloadLink(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        var uri = _trackService.BuildPublicDownloadUri(task.TrackId).ToString();
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(uri);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "下载链接已复制。";
    }

    [RelayCommand]
    private void RetryFailedDownload(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        if (_downloadService.Retry(task.Id))
        {
            RefreshDownloadTasks();
            SuccessMessage = "下载任务已重新排队。";
            return;
        }

        ErrorMessage = "该任务当前状态不可重试。";
    }

    [RelayCommand]
    private void OpenDownloadedFile(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        if (_downloadService.OpenFile(task.Id))
        {
            SuccessMessage = "已打开下载文件。";
            return;
        }

        ErrorMessage = "未找到下载文件，请先完成下载。";
    }

    [RelayCommand]
    private void OpenDownloadedFolder(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        if (_downloadService.OpenFolder(task.Id))
        {
            SuccessMessage = "已打开文件所在目录。";
            return;
        }

        ErrorMessage = "未找到下载文件目录。";
    }

    [RelayCommand]
    private async Task PreviousInboxPageAsync()
    {
        if (!HasPreviousInboxPage)
        {
            return;
        }

        InboxPage -= 1;
        await LoadInboxMessagesAsync(InboxPage);
    }

    [RelayCommand]
    private async Task NextInboxPageAsync()
    {
        if (!HasNextInboxPage)
        {
            return;
        }

        InboxPage += 1;
        await LoadInboxMessagesAsync(InboxPage);
    }

    [RelayCommand]
    private async Task StartSleepTimerAsync()
    {
        if (SleepTimerMinutes <= 0)
        {
            ErrorMessage = "请输入有效的睡眠分钟数。";
            return;
        }

        IsSleepTimerEnabled = true;
        SuccessMessage = $"睡眠定时已开启：{SleepTimerMinutes} 分钟后停止播放。";
        await Task.Delay(TimeSpan.FromMinutes(SleepTimerMinutes));
        if (!IsSleepTimerEnabled)
        {
            return;
        }

        ClearQueue();
        IsSleepTimerEnabled = false;
        SuccessMessage = "睡眠定时已到，已停止播放。";
    }

    [RelayCommand]
    private void StopSleepTimer()
    {
        IsSleepTimerEnabled = false;
    }

    [RelayCommand]
    private void ApplySleepTimerPreset(int minutes)
    {
        SleepTimerMinutes = Math.Max(0, minutes);
    }

    [RelayCommand]
    private void EnableAbLoop()
    {
        IsAbLoopEnabled = AbLoopEndSeconds > AbLoopStartSeconds;
        if (!IsAbLoopEnabled)
        {
            ErrorMessage = "请设置有效的 A-B 区间。";
            return;
        }

        SuccessMessage = "A-B 循环已开启。";
    }

    [RelayCommand]
    private void DisableAbLoop()
    {
        IsAbLoopEnabled = false;
    }

    [RelayCommand]
    private void DismissSuccess()
    {
        SuccessMessage = string.Empty;
        ShowSuccessMessage = false;
    }

    [RelayCommand]
    private void SetThemeMode(string? mode)
    {
        ThemeMode = string.Equals(mode, "dark", StringComparison.OrdinalIgnoreCase)
            ? "dark"
            : string.Equals(mode, "light", StringComparison.OrdinalIgnoreCase)
                ? "light"
                : "system";
    }

    [RelayCommand]
    private async Task RefreshInboxAsync()
    {
        await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
        await LoadUnreadMessageCountAsync();
    }

    [RelayCommand]
    private async Task MarkAllMessagesReadAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录后查看消息。";
            return;
        }

        IsInboxLoading = true;
        try
        {
            await _messageService.MarkAllMessagesReadAsync();
            await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
            await LoadUnreadMessageCountAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "标记全部已读失败，请稍后重试。");
        }
        finally
        {
            IsInboxLoading = false;
        }
    }

    [RelayCommand]
    private async Task MarkMessageReadAsync(InboxMessageItem? message)
    {
        if (!IsAuthenticated || message is null)
        {
            return;
        }

        try
        {
            await _messageService.MarkMessageReadAsync(message.Id);
            await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
            await LoadUnreadMessageCountAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "消息已读状态更新失败，请稍后重试。");
        }
    }

    [RelayCommand]
    private async Task OpenTrackDetailAsync(TrackItem? track)
    {
        var target = track
            ?? SelectedPublicTrack
            ?? SelectedFavoriteTrack
            ?? SelectedPlaylistTrack
            ?? SelectedTrack
            ?? SelectedAlbumTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择曲目。";
            return;
        }

        await LoadTrackDetailAsync(target.Id);
    }

    [RelayCommand]
    private async Task OpenAlbumTrackDetailAsync(AlbumTrackRow? row)
    {
        var target = row ?? SelectedAlbumTrackRow;
        if (target is null)
        {
            return;
        }

        await LoadTrackDetailAsync(target.Id);
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
    private async Task LocateCurrentDetailTrackInLibraryAsync()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        SearchKeyword = CurrentDetailTrack.Title;
        OpenSection(SectionLibrary);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, SearchKeyword);
        SelectedPublicTrack = PublicTracks.FirstOrDefault(item => item.Id == CurrentDetailTrack.Id)
            ?? PublicTracks.FirstOrDefault();
    }

    [RelayCommand]
    private void PlayCurrentDetailTrack()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        SelectedPublicTrack = CurrentDetailTrack;
        PlayPublicTrack();
    }

    [RelayCommand]
    private async Task ToggleFavoriteForCurrentDetailTrackAsync()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        SelectedPublicTrack = CurrentDetailTrack;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private async Task AddCurrentDetailTrackToPlaylistAsync()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(CurrentDetailTrack);
    }

    [RelayCommand]
    private void DownloadCurrentDetailTrack()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        _downloadService.Enqueue(CurrentDetailTrack.Id, CurrentDetailTrack.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void ToggleLyricsPreviewExpanded()
    {
        LyricsPreviewExpanded = !LyricsPreviewExpanded;
    }

    [RelayCommand]
    private void IncreaseLyricsFontSize()
    {
        LyricsFontSize = Math.Min(26, LyricsFontSize + 1);
    }

    [RelayCommand]
    private void DecreaseLyricsFontSize()
    {
        LyricsFontSize = Math.Max(10, LyricsFontSize - 1);
    }

    [RelayCommand]
    private void CopyDetailLyricsText()
    {
        if (string.IsNullOrWhiteSpace(DetailLyrics))
        {
            ErrorMessage = "暂无歌词可复制。";
            return;
        }

        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(DetailLyrics);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "歌词已复制。";
    }

    [RelayCommand]
    private void CopyDetailCreditsText()
    {
        if (DetailCredits.Count == 0)
        {
            ErrorMessage = "暂无制作人员信息可复制。";
            return;
        }

        var content = string.Join(Environment.NewLine, DetailCredits.Select(item => item.DisplayText));
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "制作人员信息已复制。";
    }

    [RelayCommand]
    private void CopyDetailSourcesText()
    {
        if (DetailMusicSources.Count == 0)
        {
            ErrorMessage = "暂无音乐来源信息可复制。";
            return;
        }

        var content = string.Join(Environment.NewLine, DetailMusicSources.Select(item => item.DisplayText));
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "音乐来源信息已复制。";
    }

    [RelayCommand]
    private void CopyDetailShareText()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        var shareText = $"{CurrentDetailTrack.Title} - {CurrentDetailTrack.ArtistsDisplay} | {CurrentDetailTrack.AlbumTitle} | {CurrentDetailTrack.DurationDisplay}";
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(shareText);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "分享文案已复制。";
    }

    [RelayCommand]
    private async Task RefreshFavoritesAsync()
    {
        await LoadFavoritesAsync();
    }

    [RelayCommand]
    private async Task RefreshPlaylistsAsync()
    {
        await LoadPlaylistsAsync();
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        await ApplyLoggedOutStateAsync();
    }

    [RelayCommand]
    private async Task ChangePasswordAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "需要先登录。";
            return;
        }

        if (string.IsNullOrWhiteSpace(CurrentPassword) || string.IsNullOrWhiteSpace(NewPassword))
        {
            ErrorMessage = "请输入当前密码和新密码。";
            return;
        }

        IsBusy = true;
        try
        {
            await _authService.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = CurrentPassword,
                NewPassword = NewPassword,
            });
            CurrentPassword = string.Empty;
            NewPassword = string.Empty;
            ErrorMessage = "密码修改成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "修改密码失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void PlaySelectedTrack()
    {
        if (SelectedTrack is null)
        {
            ErrorMessage = "请先选择曲目。";
            return;
        }

        PlayFromQueue(
            Tracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedTrack.Id);
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
    private void PlayPublicTrack()
    {
        if (SelectedPublicTrack is null)
        {
            ErrorMessage = "请先选择曲库曲目。";
            return;
        }

        PlayFromQueue(
            PublicTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedPublicTrack.Id);
    }

    [RelayCommand]
    private void PlayPublicTrackRow(TrackItem? track)
    {
        SelectedPublicTrack = track ?? SelectedPublicTrack;
        PlayPublicTrack();
    }

    [RelayCommand]
    private void PlayAllPublicTracks()
    {
        if (PublicTracks.Count == 0)
        {
            ErrorMessage = "曲库暂无可播放曲目。";
            return;
        }

        SelectedPublicTrack = PublicTracks[0];
        PlayFromQueue(
            PublicTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            PublicTracks[0].Id);
    }

    [RelayCommand]
    private void PlayFavoriteTrack()
    {
        if (SelectedFavoriteTrack is null)
        {
            ErrorMessage = "请先选择收藏曲目。";
            return;
        }

        PlayFromQueue(
            FavoriteTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedFavoriteTrack.Id);
    }

    [RelayCommand]
    private void PlayFavoriteTrackRow(TrackItem? track)
    {
        SelectedFavoriteTrack = track ?? SelectedFavoriteTrack;
        PlayFavoriteTrack();
    }

    [RelayCommand]
    private void PlayAllFavorites()
    {
        if (FavoriteTracks.Count == 0)
        {
            ErrorMessage = "收藏列表暂无可播放曲目。";
            return;
        }

        SelectedFavoriteTrack = FavoriteTracks[0];
        PlayFromQueue(
            FavoriteTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            FavoriteTracks[0].Id);
    }

    [RelayCommand]
    private void PlayPlaylistTrack()
    {
        if (SelectedPlaylistTrack is null)
        {
            ErrorMessage = "请先选择歌单曲目。";
            return;
        }

        PlayFromQueue(
            PlaylistTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedPlaylistTrack.Id);
    }

    [RelayCommand]
    private void PlayPlaylistTrackRow(TrackItem? track)
    {
        SelectedPlaylistTrack = track ?? SelectedPlaylistTrack;
        PlayPlaylistTrack();
    }

    [RelayCommand]
    private void PlayAllPlaylistTracks()
    {
        if (PlaylistTracks.Count == 0)
        {
            ErrorMessage = "当前歌单暂无可播放曲目。";
            return;
        }

        SelectedPlaylistTrack = PlaylistTracks[0];
        PlayFromQueue(
            PlaylistTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            PlaylistTracks[0].Id);
    }

    [RelayCommand]
    private void PlayNext()
    {
        if (!TryMoveToNext())
        {
            return;
        }

        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void PlayPrevious()
    {
        if (!TryMoveToPrevious())
        {
            return;
        }

        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void TogglePlayMode()
    {
        PlayMode = PlayMode switch
        {
            PlayModeSequence => PlayModeLoop,
            PlayModeLoop => PlayModeShuffle,
            PlayModeShuffle => PlayModeSingle,
            _ => PlayModeSequence,
        };
    }

    [RelayCommand]
    private void HandleTrackEnded()
    {
        if (!PlaybackQueueRules.TryGetIndexOnTrackEnded(PlayMode, _playbackIndex, _playbackQueue.Count, _random, out var targetIndex))
        {
            return;
        }

        _playbackIndex = targetIndex;
        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void PlayAlbumTrack()
    {
        if (SelectedAlbumTrack is null)
        {
            ErrorMessage = "请先选择专辑曲目。";
            return;
        }

        PlayFromQueue(
            AlbumTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedAlbumTrack.Id);
    }

    [RelayCommand]
    private void PlayAlbumTrackRow(AlbumTrackRow? row)
    {
        var target = row ?? SelectedAlbumTrackRow;
        if (target is null)
        {
            return;
        }

        SelectedAlbumTrack = AlbumTracks.FirstOrDefault(item => item.Id == target.Id);
        if (SelectedAlbumTrack is null)
        {
            return;
        }

        PlayAlbumTrack();
    }

    [RelayCommand]
    private void PlayAlbumAll()
    {
        if (AlbumTracks.Count == 0)
        {
            return;
        }

        PlayFromQueue(
            AlbumTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            AlbumTracks[0].Id);
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

    [RelayCommand]
    private void PlayQueueItemById(int trackId)
    {
        if (_playbackQueue.Count == 0)
        {
            return;
        }

        var index = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (index < 0)
        {
            return;
        }

        _playbackIndex = index;
        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void RemoveQueueItem(int trackId)
    {
        var index = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (index < 0)
        {
            return;
        }

        var decision = PlaybackQueueRules.DecideAfterRemoval(_playbackIndex, index, _playbackQueue.Count);
        if (!decision.IsValidRemoval)
        {
            return;
        }

        _playbackQueue.RemoveAt(index);
        if (decision.QueueBecomesEmpty)
        {
            _playbackIndex = -1;
            PlaybackQueue.Clear();
            PlaybackQueueView.Clear();
            CurrentTrackId = null;
            ResetPlaySession();
            SyncAlbumTrackPlayingState();
            NowPlaying = "暂无播放";
            StopRequested?.Invoke(this, EventArgs.Empty);
            return;
        }

        _playbackIndex = decision.NextIndex;

        SyncQueueProjection();
        if (decision.ShouldStartReplacementPlayback)
        {
            PlayQueueItem(_playbackQueue[_playbackIndex]);
        }
    }

    [RelayCommand]
    private void MoveQueueItemUp(int trackId)
    {
        MoveQueueItemByDelta(trackId, -1);
    }

    [RelayCommand]
    private void MoveQueueItemDown(int trackId)
    {
        MoveQueueItemByDelta(trackId, 1);
    }

    [RelayCommand]
    private void ClearQueue()
    {
        if (_playbackQueue.Count > 0 && DateTimeOffset.Now > _confirmClearQueueUntil)
        {
            _confirmClearQueueUntil = DateTimeOffset.Now.AddSeconds(4);
            ErrorMessage = "再次点击“清空队列”以确认操作。";
            return;
        }

        _confirmClearQueueUntil = DateTimeOffset.MinValue;
        _playbackQueue.Clear();
        _playbackIndex = -1;
        PlaybackQueue.Clear();
        PlaybackQueueView.Clear();
        CurrentTrackId = null;
        ResetPlaySession();
        SyncAlbumTrackPlayingState();
        NowPlaying = "暂无播放";
        StopRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void ReverseQueue()
    {
        if (_playbackQueue.Count <= 1)
        {
            return;
        }

        _playbackQueue.Reverse();
        _playbackIndex = _playbackQueue.FindIndex(item => item.Id == CurrentTrackId);
        SyncQueueProjection();
        SuccessMessage = "队列已反转。";
    }

    [RelayCommand]
    private void ShuffleQueue()
    {
        if (_playbackQueue.Count <= 1)
        {
            return;
        }

        var currentId = CurrentTrackId;
        var shuffled = _playbackQueue.OrderBy(_ => _random.Next()).ToList();
        _playbackQueue.Clear();
        _playbackQueue.AddRange(shuffled);
        _playbackIndex = currentId.HasValue ? _playbackQueue.FindIndex(item => item.Id == currentId.Value) : -1;
        SyncQueueProjection();
        SuccessMessage = "队列已随机排序。";
    }

    [RelayCommand]
    private void ExportQueueText()
    {
        if (_playbackQueue.Count == 0)
        {
            ErrorMessage = "当前队列为空。";
            return;
        }

        var content = string.Join(Environment.NewLine, _playbackQueue.Select((item, index) => $"{index + 1}. {item.Title} - {item.ArtistsDisplay}"));
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "队列文本已复制。";
    }

    [RelayCommand]
    private async Task ToggleFavoriteAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "收藏功能需要先登录。";
            return;
        }

        var target = SelectedFavoriteTrack ?? SelectedPublicTrack ?? SelectedTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择曲目。";
            return;
        }

        IsBusy = true;
        try
        {
            var result = await _favoriteService.ToggleAsync(target.Id);
            SuccessMessage = result.Favorited ? "已加入收藏。" : "已取消收藏。";
            await LoadFavoritesAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "收藏操作失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task CreatePlaylistAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "歌单功能需要先登录。";
            return;
        }

        if (string.IsNullOrWhiteSpace(NewPlaylistName))
        {
            ErrorMessage = "请输入歌单名称。";
            return;
        }

        IsBusy = true;
        try
        {
            var created = await _playlistService.CreatePlaylistAsync(NewPlaylistName.Trim());
            NewPlaylistName = string.Empty;
            await LoadPlaylistsAsync();
            SelectedPlaylist = Playlists.FirstOrDefault(item => item.Id == created.Id);
            SuccessMessage = "歌单创建成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "创建歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteSelectedPlaylistAsync()
    {
        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单。";
            return;
        }

        if (DateTimeOffset.Now > _confirmDeletePlaylistUntil)
        {
            _confirmDeletePlaylistUntil = DateTimeOffset.Now.AddSeconds(4);
            ErrorMessage = $"再次点击“删除”以确认删除歌单：{SelectedPlaylist.Name}";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.DeletePlaylistAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
            PlaylistTracks.Clear();
            SelectedPlaylist = null;
            _confirmDeletePlaylistUntil = DateTimeOffset.MinValue;
            SuccessMessage = "歌单已删除。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task AddSelectedTrackToPlaylistAsync()
    {
        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单。";
            return;
        }

        var targetTrack = SelectedPublicTrack ?? SelectedFavoriteTrack ?? SelectedTrack;
        if (targetTrack is null)
        {
            ErrorMessage = "请先选择要添加的曲目。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.AddTrackAsync(SelectedPlaylist.Id, targetTrack.Id);
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "添加曲目到歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RemovePlaylistTrackAsync()
    {
        if (SelectedPlaylist is null || SelectedPlaylistTrack is null)
        {
            ErrorMessage = "请先选择歌单中的曲目。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.RemoveTrackAsync(SelectedPlaylist.Id, SelectedPlaylistTrack.Id);
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "移除歌单曲目失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateSelectedPlaylistAsync()
    {
        if (!IsAuthenticated || SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单并登录。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.UpdatePlaylistAsync(SelectedPlaylist.Id, PlaylistEditName, PlaylistEditDescription);
            await LoadPlaylistsAsync();
            SuccessMessage = "歌单信息已更新。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DuplicateSelectedPlaylistAsync()
    {
        if (!IsAuthenticated || SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单并登录。";
            return;
        }

        IsBusy = true;
        try
        {
            var detail = await _playlistService.GetPlaylistByIdAsync(SelectedPlaylist.Id);
            var cloned = await _playlistService.CreatePlaylistAsync($"{SelectedPlaylist.Name} - 副本", SelectedPlaylist.Description);
            foreach (var track in detail.Tracks)
            {
                try
                {
                    await _playlistService.AddTrackAsync(cloned.Id, track.Id);
                }
                catch
                {
                    // Keep best-effort duplication.
                }
            }

            await LoadPlaylistsAsync();
            SuccessMessage = "歌单副本创建成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "复制歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task MoveSelectedPlaylistTrackUpAsync()
    {
        await ReorderSelectedPlaylistTrackAsync(-1);
    }

    [RelayCommand]
    private async Task MoveSelectedPlaylistTrackDownAsync()
    {
        await ReorderSelectedPlaylistTrackAsync(1);
    }

    [RelayCommand]
    private Task PlayPlaylistFromSelectedTrackAsync()
    {
        if (SelectedPlaylistTrack is null)
        {
            ErrorMessage = "请先选择歌单曲目。";
            return Task.CompletedTask;
        }

        var startIndex = PlaylistTracksView.IndexOf(SelectedPlaylistTrack);
        if (startIndex < 0)
        {
            startIndex = 0;
        }

        var queue = PlaylistTracksView.Skip(startIndex)
            .Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration))
            .ToList();
        if (queue.Count == 0)
        {
            return Task.CompletedTask;
        }

        PlayFromQueue(queue, queue[0].Id);
        return Task.CompletedTask;
    }

    [RelayCommand]
    private async Task SaveQueueAsPlaylistAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录。";
            return;
        }

        if (_playbackQueue.Count == 0)
        {
            ErrorMessage = "当前队列为空。";
            return;
        }

        IsBusy = true;
        try
        {
            var playlist = await _playlistService.CreatePlaylistAsync($"队列 {DateTime.Now:MMdd-HHmm}");
            foreach (var item in _playbackQueue)
            {
                try
                {
                    await _playlistService.AddTrackAsync(playlist.Id, item.Id);
                }
                catch
                {
                    // Keep best-effort save behavior.
                }
            }

            await LoadPlaylistsAsync();
            SuccessMessage = "队列已保存为新歌单。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "保存队列为歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void PlayFilteredPublicTracks()
    {
        if (PublicTracks.Count == 0)
        {
            ErrorMessage = "当前无可播放曲目。";
            return;
        }

        PlayFromQueue(
            PublicTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            PublicTracks[0].Id);
    }

    [RelayCommand]
    private void QueueFilteredPublicTracks()
    {
        foreach (var track in PublicTracks)
        {
            AppendToQueue(new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration));
        }

        SuccessMessage = "当前曲库结果已加入队列。";
    }

    [RelayCommand]
    private async Task BatchAddPublicTracksToPlaylistAsync()
    {
        if (!IsAuthenticated || SelectedPlaylist is null)
        {
            ErrorMessage = "请先登录并选择目标歌单。";
            return;
        }

        if (PublicTracks.Count == 0)
        {
            ErrorMessage = "当前没有曲库结果可添加。";
            return;
        }

        IsBusy = true;
        var added = 0;
        foreach (var track in PublicTracks)
        {
            try
            {
                await _playlistService.AddTrackAsync(SelectedPlaylist.Id, track.Id);
                added++;
            }
            catch
            {
                // Keep best-effort batch behavior.
            }
        }

        await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
        IsBusy = false;
        SuccessMessage = $"已添加 {added}/{PublicTracks.Count} 首曲库曲目到歌单。";
    }

    [RelayCommand]
    private void ExportCurrentPlaylistText()
    {
        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单。";
            return;
        }

        var lines = PlaylistTracksView.Select((track, index) => $"{index + 1}. {track.Title} - {track.ArtistsDisplay}");
        var content = string.Join(Environment.NewLine, lines);
        if (string.IsNullOrWhiteSpace(content))
        {
            ErrorMessage = "当前歌单没有可导出曲目。";
            return;
        }

        var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
        dataPackage.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(dataPackage);
        SuccessMessage = "歌单文本已复制到剪贴板。";
    }

    private async Task ReorderSelectedPlaylistTrackAsync(int delta)
    {
        if (!IsAuthenticated || SelectedPlaylist is null || SelectedPlaylistTrack is null)
        {
            return;
        }

        var tracks = PlaylistTracks.ToList();
        var index = tracks.FindIndex(item => item.Id == SelectedPlaylistTrack.Id);
        if (index < 0)
        {
            return;
        }

        var targetIndex = index + delta;
        if (targetIndex < 0 || targetIndex >= tracks.Count)
        {
            return;
        }

        (tracks[index], tracks[targetIndex]) = (tracks[targetIndex], tracks[index]);
        try
        {
            await _playlistService.ReorderTracksAsync(SelectedPlaylist.Id, tracks.Select(item => item.Id).ToList());
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "调整歌单顺序失败，请稍后重试。");
        }
    }

    private void PlayTrackById(int trackId, string nowPlayingText, int? durationSeconds)
    {
        try
        {
            var streamUri = _trackService.BuildPublicStreamUri(trackId);
            CurrentTrackId = trackId;
            BeginPlaySession(trackId, durationSeconds);
            SyncAlbumTrackPlayingState();
            NowPlaying = nowPlayingText;
            ErrorMessage = string.Empty;
            PlayRequested?.Invoke(this, streamUri);
        }
        catch (Exception ex)
        {
            ErrorMessage = $"无法开始播放：{ex.Message}";
        }
    }

    public void NotifyPlaybackProgress(double playedSeconds, double? durationSeconds = null)
    {
        if (!CurrentTrackId.HasValue)
        {
            return;
        }

        var normalizedPlayedSeconds = (int)Math.Floor(Math.Max(playedSeconds, 0));
        var durationForRule = ResolveDurationForPlayReport(durationSeconds);
        if (!EffectivePlayReportRules.ShouldReport(normalizedPlayedSeconds, durationForRule, _effectivePlayReported))
        {
            return;
        }

        _effectivePlayReported = true;
        _ = RecordPlayBestEffortAsync(CurrentTrackId.Value, normalizedPlayedSeconds, durationForRule, _activePlaySessionKey);
    }

    private int? ResolveDurationForPlayReport(double? durationSeconds)
    {
        if (durationSeconds.HasValue && durationSeconds.Value > 0)
        {
            return (int)Math.Round(durationSeconds.Value, MidpointRounding.AwayFromZero);
        }

        if (_activeTrackDurationSeconds.HasValue && _activeTrackDurationSeconds.Value > 0)
        {
            return _activeTrackDurationSeconds.Value;
        }

        return null;
    }

    private void BeginPlaySession(int trackId, int? durationSeconds)
    {
        _activeTrackDurationSeconds = durationSeconds;
        _effectivePlayReported = false;
        _activePlaySessionKey = $"{trackId}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}";
    }

    private void ResetPlaySession()
    {
        _effectivePlayReported = false;
        _activeTrackDurationSeconds = null;
    }

    private void PlayFromQueue(IReadOnlyList<PlaybackQueueItem> queue, int trackId)
    {
        if (queue.Count == 0)
        {
            return;
        }

        _playbackQueue.Clear();
        if (PreventDuplicateQueueItems)
        {
            _playbackQueue.AddRange(queue.GroupBy(item => item.Id).Select(group => group.First()));
        }
        else
        {
            _playbackQueue.AddRange(queue);
        }
        _playbackIndex = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (_playbackIndex < 0)
        {
            _playbackIndex = 0;
        }

        PlayQueueItem(_playbackQueue[_playbackIndex]);
        SyncQueueProjection();
    }

    private void AppendToQueue(PlaybackQueueItem item)
    {
        if (PreventDuplicateQueueItems && _playbackQueue.Any(queueItem => queueItem.Id == item.Id))
        {
            return;
        }

        _playbackQueue.Add(item);
        SyncQueueProjection();

        if (QueueAutoPlayOnAdd && _playbackIndex < 0)
        {
            _playbackIndex = 0;
            PlayQueueItem(item);
        }
    }

    private void PlayQueueItem(PlaybackQueueItem item)
    {
        var display = string.IsNullOrWhiteSpace(item.ArtistsDisplay)
            ? $"播放中：{item.Title}"
            : $"播放中：{item.Title} - {item.ArtistsDisplay}";
        PlayTrackById(item.Id, display, item.DurationSeconds);
    }

    private async Task RecordPlayBestEffortAsync(int trackId, int playedSeconds, int? durationSeconds, string? sessionKey)
    {
        try
        {
            await _trackService.RecordPlayAsync(trackId, playedSeconds, durationSeconds, sessionKey ?? _sessionKey);
        }
        catch
        {
            // Playback should not fail because analytics endpoint is temporarily unavailable.
        }
    }

    private async Task LoadTracksAsync()
    {
        IsBusy = true;
        ErrorMessage = string.Empty;

        try
        {
            var tracks = await _trackService.GetTracksAsync(gameIds: GetSelectedGameIds());
            Tracks.Clear();
            foreach (var track in tracks)
            {
                Tracks.Add(track);
            }
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载曲目失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"加载曲目失败：{ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
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
                    await LoadGamesAsync();
                }
                break;
            case AdminSectionArtists:
                if (forceReload)
                {
                    await LoadTracksAsync();
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

    private void RememberPendingSection(string section)
    {
        if (string.IsNullOrWhiteSpace(section))
        {
            return;
        }

        if (section == SectionAdmin || IsRestrictedSection(section))
        {
            _pendingSectionAfterLogin = section;
        }
    }

    private async Task TryRestorePendingSectionAfterLoginAsync()
    {
        var pending = _pendingSectionAfterLogin;
        _pendingSectionAfterLogin = null;
        if (string.IsNullOrWhiteSpace(pending))
        {
            return;
        }

        if (pending == SectionAdmin && !IsAdmin)
        {
            return;
        }

        if (IsRestrictedSection(pending) && !IsAuthenticated)
        {
            return;
        }

        OpenSection(pending);
        if (pending == SectionAdmin && IsAdmin)
        {
            await EnsureAdminSectionDataAsync(forceReload: false);
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

    private async Task LoadSiteConfigAsync()
    {
        try
        {
            var maintenanceTask = _siteConfigService.GetPublicMaintenanceModeAsync();
            var firstVisitTask = _siteConfigService.GetPublicFirstVisitModalAsync();
            var complianceTask = _siteConfigService.GetPublicComplianceConfigAsync();

            var maintenance = await maintenanceTask;
            IsMaintenanceMode = maintenance.Enabled;
            MaintenanceMessage = string.IsNullOrWhiteSpace(maintenance.Message) ? "站点维护中，请稍后再试。" : maintenance.Message.Trim();
            MaintenanceExpectedEndTimeText = string.IsNullOrWhiteSpace(maintenance.ExpectedEndTime)
                ? ""
                : $"预计恢复时间：{maintenance.ExpectedEndTime}";

            var firstVisit = await firstVisitTask;
            _activeFirstVisitVersion = string.IsNullOrWhiteSpace(firstVisit.Version) ? "1" : firstVisit.Version.Trim();
            FirstVisitTitle = string.IsNullOrWhiteSpace(firstVisit.Title) ? "欢迎来到 HoYoMusic" : firstVisit.Title.Trim();
            FirstVisitContent = string.IsNullOrWhiteSpace(firstVisit.Content) ? "请先阅读并确认使用须知。" : firstVisit.Content.Trim();

            var ackKey = $"first_visit_ack_{_activeFirstVisitVersion}";
            var hasAck = TryGetLocalSettingBool(ackKey);

            if (firstVisit.Enabled && !hasAck)
            {
                var minStaySeconds = Math.Clamp(firstVisit.MinStaySeconds, 0, 60);
                ShowFirstVisitModal = true;
                FirstVisitAcknowledgeEnabled = minStaySeconds == 0;
                FirstVisitCountdownSeconds = minStaySeconds;
                _ = RunFirstVisitCountdownAsync(minStaySeconds);
            }
            else
            {
                ShowFirstVisitModal = false;
                FirstVisitAcknowledgeEnabled = false;
                FirstVisitCountdownSeconds = 0;
            }

            var compliance = await complianceTask;
            ShowComplianceFooter = compliance.Enabled;
            ComplianceIcpNumber = compliance.IcpNumber;
            CompliancePublicSecurityNumber = compliance.PublicSecurityNumber;
        }
        catch
        {
            // Site config is best-effort; keep app usable when this public endpoint is unavailable.
            ShowComplianceFooter = false;
            IsMaintenanceMode = false;
            ShowFirstVisitModal = false;
            FirstVisitAcknowledgeEnabled = false;
            FirstVisitCountdownSeconds = 0;
        }
    }

    private async Task RunFirstVisitCountdownAsync(int seconds)
    {
        _firstVisitCountdownCts?.Cancel();
        _firstVisitCountdownCts?.Dispose();
        _firstVisitCountdownCts = new CancellationTokenSource();
        var token = _firstVisitCountdownCts.Token;

        for (var remaining = seconds; remaining > 0; remaining--)
        {
            FirstVisitCountdownSeconds = remaining;
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(1), token);
            }
            catch (TaskCanceledException)
            {
                return;
            }
        }

        FirstVisitCountdownSeconds = 0;
        FirstVisitAcknowledgeEnabled = true;
    }

    private void PushRecentSearchKeyword(string keyword)
    {
        for (var i = RecentSearchKeywords.Count - 1; i >= 0; i--)
        {
            if (string.Equals(RecentSearchKeywords[i], keyword, StringComparison.OrdinalIgnoreCase))
            {
                RecentSearchKeywords.RemoveAt(i);
            }
        }

        RecentSearchKeywords.Insert(0, keyword);
        while (RecentSearchKeywords.Count > 8)
        {
            RecentSearchKeywords.RemoveAt(RecentSearchKeywords.Count - 1);
        }
    }

    private void RefreshFacetCollections()
    {
        var sourceTracks = PublicTracks
            .Concat(FavoriteTracks)
            .Concat(PlaylistTracks)
            .GroupBy(item => item.Id)
            .Select(group => group.First())
            .ToList();

        ArtistFacetItems.Clear();
        foreach (var facet in sourceTracks
                     .SelectMany(item => item.Artists)
                     .GroupBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
                     .OrderByDescending(group => group.Count())
                     .ThenBy(group => group.Key)
                     .Take(20)
                     .Select(group => new FacetItem(group.Key, group.Key, group.Count())))
        {
            ArtistFacetItems.Add(facet);
        }

        var durationFacets = sourceTracks
            .Where(item => item.Duration is not null)
            .GroupBy(item => item.Duration switch
            {
                <= 120 => "short",
                <= 300 => "medium",
                _ => "long",
            })
            .Select(group => new FacetItem($"时长 {group.Key}", $"duration:{group.Key}", group.Count()));

        TagFacetItems.Clear();
        foreach (var facet in durationFacets.OrderByDescending(item => item.Count))
        {
            TagFacetItems.Add(facet);
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

    private async Task LoadPublicTracksAsync(int page = 1, string? search = null)
    {
        IsLibraryLoading = true;
        ShowLibraryStatus = true;
        LibraryStatusMessage = "正在加载曲库...";
        try
        {
            var query = new TrackQueryOptions
            {
                Search = search ?? SearchKeyword,
                GameIds = ParseGameIdsOrDefault(),
                Artist = SearchArtist,
                YearFrom = ParsePositiveIntOrNull(YearFromText),
                YearTo = ParsePositiveIntOrNull(YearToText),
                DurationMin = ParsePositiveIntOrNull(DurationMinText),
                DurationMax = ParsePositiveIntOrNull(DurationMaxText),
                DurationBucket = string.IsNullOrWhiteSpace(DurationBucket) ? null : DurationBucket,
                LyricsStatus = string.IsNullOrWhiteSpace(LyricsStatus) ? null : LyricsStatus,
                HasLyrics = LibraryHasLyricsOnly ? true : null,
                SortBy = string.IsNullOrWhiteSpace(LibrarySortBy) ? SortReleaseDate : LibrarySortBy,
                SortDir = string.Equals(LibrarySortDir, "ASC", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC",
            };

            var pageResult = await _trackService.GetPublicTrackPageAsync(page: Math.Max(1, page), limit: Math.Clamp(LibraryLimit, 10, 100), options: query);
            PublicTracks.Clear();
            foreach (var track in pageResult.Tracks)
            {
                PublicTracks.Add(track);
            }

            LibraryPage = pageResult.Pagination?.Page > 0 ? pageResult.Pagination.Page : Math.Max(1, page);
            LibraryTotalPages = Math.Max(1, pageResult.Pagination?.TotalPages ?? 1);
            LibraryTotal = Math.Max(0, pageResult.Pagination?.Total ?? PublicTracks.Count);

            if (PublicTracks.Count == 0)
            {
                ShowLibraryStatus = true;
                LibraryStatusMessage = "未找到匹配曲目。";
            }
            else
            {
                ShowLibraryStatus = false;
                LibraryStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowLibraryStatus = true;
            LibraryStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载曲库失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载曲库失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"加载公开曲目失败：{ex.Message}";
            ShowLibraryStatus = true;
            LibraryStatusMessage = "加载曲库失败，请稍后重试。";
        }
        finally
        {
            IsLibraryLoading = false;
        }
    }

    private async Task LoadFavoritesAsync()
    {
        IsFavoritesLoading = true;
        ShowFavoritesStatus = true;
        FavoritesStatusMessage = "正在加载收藏...";
        if (!IsAuthenticated)
        {
            FavoriteTracks.Clear();
            FavoriteTracksView.Clear();
            FavoritesStatusMessage = "请先登录后查看收藏。";
            IsFavoritesLoading = false;
            return;
        }

        try
        {
            var tracks = await _favoriteService.GetFavoritesAsync();
            FavoriteTracks.Clear();
            foreach (var track in tracks)
            {
                FavoriteTracks.Add(track);
            }

            ApplyFavoriteFilters();
            OnPropertyChanged(nameof(ProfileSummary));

            if (FavoriteTracks.Count == 0)
            {
                ShowFavoritesStatus = true;
                FavoritesStatusMessage = "你还没有收藏任何曲目。";
            }
            else
            {
                ShowFavoritesStatus = false;
                FavoritesStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowFavoritesStatus = true;
            FavoritesStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载收藏失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载收藏失败，请稍后重试。");
        }
        finally
        {
            IsFavoritesLoading = false;
        }
    }

    private async Task LoadPlaylistsAsync()
    {
        IsPlaylistsLoading = true;
        ShowPlaylistsStatus = true;
        PlaylistsStatusMessage = "正在加载歌单...";
        if (!IsAuthenticated)
        {
            Playlists.Clear();
            PlaylistsView.Clear();
            PlaylistsStatusMessage = "请先登录后查看歌单。";
            IsPlaylistsLoading = false;
            return;
        }

        try
        {
            var playlists = await _playlistService.GetPlaylistsAsync();
            Playlists.Clear();
            foreach (var playlist in playlists)
            {
                Playlists.Add(playlist);
            }

            ApplyPlaylistFilters();
            OnPropertyChanged(nameof(ProfileSummary));

            if (Playlists.Count == 0)
            {
                ShowPlaylistsStatus = true;
                PlaylistsStatusMessage = "还没有歌单，先创建一个吧。";
            }
            else
            {
                ShowPlaylistsStatus = false;
                PlaylistsStatusMessage = string.Empty;
            }

            OnPropertyChanged(nameof(HasSelectedPlaylist));
            OnPropertyChanged(nameof(SelectedPlaylistSummary));
        }
        catch (ApiException ex)
        {
            ShowPlaylistsStatus = true;
            PlaylistsStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载歌单失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载歌单失败，请稍后重试。");
        }
        finally
        {
            IsPlaylistsLoading = false;
        }
    }

    private async Task LoadPlaylistDetailAsync(int playlistId)
    {
        try
        {
            var detail = await _playlistService.GetPlaylistByIdAsync(playlistId);
            PlaylistTracks.Clear();
            foreach (var track in detail.Tracks)
            {
                PlaylistTracks.Add(track);
            }

            ApplyPlaylistTrackFilters();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载歌单详情失败，请稍后重试。");
        }
    }

    private async Task LoadUnreadMessageCountAsync()
    {
        if (!IsAuthenticated)
        {
            UnreadMessageCount = 0;
            return;
        }

        try
        {
            UnreadMessageCount = await _messageService.GetUnreadCountAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载未读消息数失败，请稍后重试。");
        }
    }

    private async Task LoadInboxMessagesAsync(int page = 1)
    {
        IsInboxLoading = true;
        ShowInboxStatus = true;
        InboxStatusMessage = "正在加载消息...";

        if (!IsAuthenticated)
        {
            InboxMessages.Clear();
            InboxStatusMessage = "请先登录后查看消息。";
            IsInboxLoading = false;
            return;
        }

        try
        {
            var data = await _messageService.GetInboxMessagesAsync(page, 20);
            InboxPage = data.Pagination?.Page > 0 ? data.Pagination.Page : page;
            InboxTotalPages = Math.Max(1, data.Pagination?.TotalPages ?? 1);
            InboxTotal = Math.Max(0, data.Pagination?.Total ?? data.Items.Count);

            IEnumerable<InboxMessageItem> items = data.Items;
            if (ShowUnreadOnly)
            {
                items = items.Where(item => !item.IsRead);
            }

            if (!string.IsNullOrWhiteSpace(MessageSearchText))
            {
                var keyword = MessageSearchText.Trim();
                items = items.Where(item =>
                    item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                    item.Content.Contains(keyword, StringComparison.OrdinalIgnoreCase));
            }

            InboxMessages.Clear();
            foreach (var item in items)
            {
                InboxMessages.Add(item);
            }

            if (InboxMessages.Count == 0)
            {
                ShowInboxStatus = true;
                InboxStatusMessage = "暂无站内消息。";
            }
            else
            {
                ShowInboxStatus = false;
                InboxStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowInboxStatus = true;
            InboxStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载消息失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载消息失败，请稍后重试。");
        }
        finally
        {
            IsInboxLoading = false;
        }
    }

    private async Task LoadTrackDetailAsync(int trackId)
    {
        IsTrackDetailLoading = true;
        ShowTrackDetailStatus = true;
        TrackDetailStatusMessage = "正在加载曲目详情...";

        try
        {
            CurrentDetailTrack = await _trackService.GetPublicTrackByIdAsync(trackId);

            var lyricsTask = _lyricsService.GetLyricsAsync(trackId);
            var creditsTask = _creditsService.GetCreditsAsync(trackId);
            var sourcesTask = _musicSourceService.GetTrackMusicSourcesAsync(trackId);

            try
            {
                var lyrics = await lyricsTask;
                DetailLyrics = lyrics.Lyrics;
                DetailLyricsStatus = string.IsNullOrWhiteSpace(lyrics.LyricsStatus) ? "unknown" : lyrics.LyricsStatus;
            }
            catch (ApiException ex) when (ex.Code is "NO_LYRICS" or "INSTRUMENTAL_TRACK" or "NOT_FOUND")
            {
                DetailLyrics = ex.Code == "INSTRUMENTAL_TRACK" ? "纯音乐，无歌词。" : "暂无歌词。";
                DetailLyricsStatus = ex.Code == "INSTRUMENTAL_TRACK" ? "instrumental" : "none";
            }

            IReadOnlyList<CreditItem> credits;
            try
            {
                credits = await creditsTask;
            }
            catch (ApiException)
            {
                credits = Array.Empty<CreditItem>();
            }

            DetailCredits.Clear();
            foreach (var credit in credits)
            {
                DetailCredits.Add(credit);
            }
            OnPropertyChanged(nameof(DetailCreditsSummary));

            IReadOnlyList<TrackMusicSourceItem> sources;
            try
            {
                sources = await sourcesTask;
            }
            catch (ApiException)
            {
                sources = Array.Empty<TrackMusicSourceItem>();
            }

            DetailMusicSources.Clear();
            foreach (var source in sources)
            {
                DetailMusicSources.Add(source);
            }
            OnPropertyChanged(nameof(DetailMusicSourcesSummary));

            ShowTrackDetailStatus = false;
            TrackDetailStatusMessage = string.Empty;
        }
        catch (ApiException ex)
        {
            CurrentDetailTrack = null;
            DetailLyrics = string.Empty;
            DetailLyricsStatus = string.Empty;
            DetailCredits.Clear();
            DetailMusicSources.Clear();
            ShowTrackDetailStatus = true;
            TrackDetailStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载曲目详情失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载曲目详情失败，请稍后重试。");
        }
        finally
        {
            IsTrackDetailLoading = false;
        }
    }

    private async Task ApplyLoggedOutStateAsync(bool clearError = true)
    {
        if (SelectedSection == SectionAdmin || IsRestrictedSection(SelectedSection))
        {
            RememberPendingSection(SelectedSection);
        }

        await _authService.LogoutAsync();
        Tracks.Clear();
        FavoriteTracks.Clear();
        Playlists.Clear();
        PlaylistTracks.Clear();
        InboxMessages.Clear();
        UnreadMessageCount = 0;
        IsAuthenticated = false;
        SelectedTrack = null;
        SelectedFavoriteTrack = null;
        SelectedPlaylist = null;
        SelectedPlaylistTrack = null;
        CurrentPassword = string.Empty;
        NewPassword = string.Empty;
        CurrentUserDisplay = "游客";
        IsAdmin = false;
        NowPlaying = "暂无播放";
        CurrentTrackId = null;
        CurrentDetailTrack = null;
        DetailLyrics = string.Empty;
        DetailLyricsStatus = string.Empty;
        DetailCredits.Clear();
        DetailMusicSources.Clear();
        AdminUsers.Clear();
        AdminTags.Clear();
        AdminTagGroups.Clear();
        AdminFeedbackItems.Clear();
        AdminDiscs.Clear();
        AdminLyricsPreviewItems.Clear();
        AdminLyricsCommitItems.Clear();
        ShowInboxStatus = false;
        InboxStatusMessage = string.Empty;
        ShowTrackDetailStatus = false;
        TrackDetailStatusMessage = string.Empty;
        SuccessMessage = string.Empty;
        ShowSuccessMessage = false;
        SyncAlbumTrackPlayingState();
        ClearQueue();
        if (SelectedSection == SectionAdmin)
        {
            SelectedSection = SectionDiscover;
            SelectedSectionIndex = 0;
        }
        if (clearError)
        {
            ErrorMessage = string.Empty;
        }
    }

    private async Task LoadGamesAsync()
    {
        try
        {
            var games = await _gameService.GetGamesAsync();
            Games.Clear();
            foreach (var game in games)
            {
                Games.Add(game);
            }

            if (Games.Count == 0)
            {
                SelectedGame = null;
                ErrorMessage = "加载游戏失败：服务器返回空列表。";
                return;
            }

            var currentId = SelectedGame?.Id;
            SelectedGame = currentId is not null
                ? Games.FirstOrDefault(item => item.Id == currentId.Value) ?? Games.First()
                : Games.First();
            OnPropertyChanged(nameof(SelectedGameSummary));
        }
        catch (ApiException ex)
        {
            Games.Clear();
            SelectedGame = null;
            await HandleApiExceptionAsync(ex, "加载游戏失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            Games.Clear();
            SelectedGame = null;
            ErrorMessage = $"加载游戏失败：{ex.Message}";
        }
    }

    private async Task ApplySelectedGameAsync()
    {
        IsBusy = true;
        try
        {
            await LoadSelectedGameAlbumsAsync();
            await LoadDiscoverAsync();
            await LoadPublicTracksAsync(search: SearchKeyword);
            if (IsAuthenticated)
            {
                await LoadTracksAsync();
            }
        }
        finally
        {
            IsBusy = false;
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

    private async Task LoadSelectedGameAlbumsAsync()
    {
        if (SelectedGame is null)
        {
            SelectedGameAlbums.Clear();
            return;
        }

        try
        {
            var albums = await _gameService.GetGameAlbumsAsync(SelectedGame.Id);
            SelectedGameAlbums.Clear();
            foreach (var album in albums)
            {
                SelectedGameAlbums.Add(album);
            }

            if (SelectedGameAlbums.Count > 0)
            {
                var nextAlbum = SelectedGameAlbum is null
                    ? SelectedGameAlbums[0]
                    : SelectedGameAlbums.FirstOrDefault(item => item.Id == SelectedGameAlbum.Id) ?? SelectedGameAlbums[0];
                SelectedGameAlbum = nextAlbum;
            }
            else
            {
                SelectedGameAlbum = null;
            }

            OnPropertyChanged(nameof(SelectedGameSummary));
            OnPropertyChanged(nameof(DiscoverSummary));
        }
        catch (ApiException ex)
        {
            SelectedGameAlbums.Clear();
            SelectedGameAlbum = null;
            await HandleApiExceptionAsync(ex, "加载游戏专辑失败，请稍后重试。");
        }
    }

    private async Task LoadSelectedAlbumAsync(int albumId)
    {
        IsAlbumLoading = true;
        ShowAlbumStatus = true;
        AlbumStatusMessage = "正在加载专辑详情...";
        try
        {
            var detail = await _albumService.GetAlbumByIdAsync(albumId);
            CurrentAlbum = detail.Album;
            AlbumTracks.Clear();
            AlbumTrackRows.Clear();
            foreach (var track in detail.Tracks)
            {
                AlbumTracks.Add(track);
                AlbumTrackRows.Add(new AlbumTrackRow
                {
                    Id = track.Id,
                    Title = track.Title,
                    ArtistsDisplay = track.ArtistsDisplay,
                    DurationSeconds = track.Duration,
                    IsCurrentPlaying = CurrentTrackId == track.Id,
                });
            }

            SelectedAlbumTrack = AlbumTracks.FirstOrDefault();
            SelectedAlbumTrackRow = AlbumTrackRows.FirstOrDefault();
            if (AlbumTrackRows.Count == 0)
            {
                ShowAlbumStatus = true;
                AlbumStatusMessage = "该专辑暂无曲目。";
            }
            else
            {
                ShowAlbumStatus = false;
                AlbumStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            CurrentAlbum = null;
            AlbumTracks.Clear();
            AlbumTrackRows.Clear();
            ShowAlbumStatus = true;
            AlbumStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载专辑详情失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载专辑详情失败，请稍后重试。");
        }
        finally
        {
            IsAlbumLoading = false;
        }
    }

    private bool TryMoveToNext()
    {
        if (!PlaybackQueueRules.TryGetNextIndex(PlayMode, _playbackIndex, _playbackQueue.Count, _random, out var nextIndex))
        {
            return false;
        }

        _playbackIndex = nextIndex;
        return true;
    }

    private bool TryMoveToPrevious()
    {
        if (!PlaybackQueueRules.TryGetPreviousIndex(PlayMode, _playbackIndex, _playbackQueue.Count, _random, out var previousIndex))
        {
            return false;
        }

        _playbackIndex = previousIndex;
        return true;
    }

    private void SyncQueueProjection()
    {
        PlaybackQueue.Clear();
        foreach (var queueItem in _playbackQueue)
        {
            PlaybackQueue.Add(queueItem);
        }

        ApplyQueueFilters();
    }

    private void SyncAlbumTrackPlayingState()
    {
        foreach (var row in AlbumTrackRows)
        {
            row.IsCurrentPlaying = CurrentTrackId.HasValue && row.Id == CurrentTrackId.Value;
        }
    }

    [RelayCommand]
    private async Task QuickPlayAlbumAsync(GameAlbumItem? album)
    {
        var target = album ?? SelectedGameAlbum;
        if (target is null)
        {
            ErrorMessage = "请先选择专辑。";
            return;
        }

        SelectedGameAlbum = target;
        await LoadSelectedAlbumAsync(target.Id);
        if (AlbumTracks.Count == 0)
        {
            ErrorMessage = "该专辑暂无可播放曲目。";
            return;
        }

        OpenSection(SectionAlbumDetail);
        PlayAlbumAll();
    }

    [RelayCommand]
    private async Task PlaySelectedGameAllAsync()
    {
        if (SelectedGame is null)
        {
            ErrorMessage = "请先选择游戏。";
            return;
        }

        IsBusy = true;
        try
        {
            var tracks = await _trackService.GetPublicTracksAsync(limit: 100, gameIds: GetSelectedGameIds());
            if (tracks.Count == 0)
            {
                ErrorMessage = "当前游戏暂无可播放曲目。";
                return;
            }

            PlayFromQueue(
                tracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
                tracks[0].Id);
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载当前游戏曲目失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void PlayRandomTrack(PublicTrackItem? track)
    {
        PlayDiscoverTrack(track);
    }

    [RelayCommand]
    private void PlayTopTrack(PublicTrackItem? track)
    {
        var target = track;
        if (target is null)
        {
            ErrorMessage = "请先选择热门曲目。";
            return;
        }

        PlayFromQueue(
            TopTracks.Select(item => new PlaybackQueueItem(item.Id, item.Title, item.AlbumTitle ?? string.Empty, item.Duration)).ToList(),
            target.Id);
    }

    [RelayCommand]
    private async Task ToggleFavoriteForPublicTrackAsync(TrackItem? track)
    {
        SelectedPublicTrack = track ?? SelectedPublicTrack;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private async Task ToggleFavoriteForFavoriteTrackAsync(TrackItem? track)
    {
        SelectedFavoriteTrack = track ?? SelectedFavoriteTrack;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private async Task AddPublicTrackToPlaylistAsync(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择曲库曲目。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(target);
    }

    [RelayCommand]
    private async Task AddFavoriteTrackToPlaylistAsync(TrackItem? track)
    {
        var target = track ?? SelectedFavoriteTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择收藏曲目。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(target);
    }

    [RelayCommand]
    private async Task AddAlbumTrackToPlaylistAsync(AlbumTrackRow? row)
    {
        var targetRow = row ?? SelectedAlbumTrackRow;
        if (targetRow is null)
        {
            ErrorMessage = "请先选择专辑曲目。";
            return;
        }

        var targetTrack = AlbumTracks.FirstOrDefault(item => item.Id == targetRow.Id);
        if (targetTrack is null)
        {
            ErrorMessage = "未找到对应曲目。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(targetTrack);
    }

    private async Task AddTrackToSelectedPlaylistAsync(TrackItem targetTrack)
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "歌单功能需要先登录。";
            return;
        }

        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择目标歌单。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.AddTrackAsync(SelectedPlaylist.Id, targetTrack.Id);
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
            SuccessMessage = $"已添加到歌单：{SelectedPlaylist.Name}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "添加到歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ApplyFavoriteFilters()
    {
        IEnumerable<TrackItem> query = FavoriteTracks;
        if (!string.IsNullOrWhiteSpace(FavoriteSearchText))
        {
            var keyword = FavoriteSearchText.Trim();
            query = query.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                item.ArtistsDisplay.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        query = FavoriteSortBy switch
        {
            "duration" => FavoriteSortDesc
                ? query.OrderByDescending(item => item.Duration ?? 0)
                : query.OrderBy(item => item.Duration ?? 0),
            _ => FavoriteSortDesc
                ? query.OrderByDescending(item => item.Title)
                : query.OrderBy(item => item.Title),
        };

        FavoriteTracksView.Clear();
        foreach (var item in query)
        {
            FavoriteTracksView.Add(item);
        }
    }

    private void ApplyPlaylistFilters()
    {
        IEnumerable<PlaylistItem> query = Playlists;
        if (!string.IsNullOrWhiteSpace(PlaylistSearchText))
        {
            var keyword = PlaylistSearchText.Trim();
            query = query.Where(item => item.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        PlaylistsView.Clear();
        foreach (var item in query.OrderBy(item => item.Name))
        {
            PlaylistsView.Add(item);
        }
    }

    private void ApplyPlaylistTrackFilters()
    {
        IEnumerable<TrackItem> query = PlaylistTracks;
        if (!string.IsNullOrWhiteSpace(PlaylistTrackSearchText))
        {
            var keyword = PlaylistTrackSearchText.Trim();
            query = query.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                item.ArtistsDisplay.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        PlaylistTracksView.Clear();
        foreach (var item in query)
        {
            PlaylistTracksView.Add(item);
        }
    }

    private void ApplyQueueFilters()
    {
        IEnumerable<PlaybackQueueItem> query = PlaybackQueue;
        if (!string.IsNullOrWhiteSpace(QueueFilterText))
        {
            var keyword = QueueFilterText.Trim();
            query = query.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                item.ArtistsDisplay.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        PlaybackQueueView.Clear();
        foreach (var item in query)
        {
            PlaybackQueueView.Add(item);
        }
    }

    private void MoveQueueItemByDelta(int trackId, int delta)
    {
        var sourceIndex = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (sourceIndex < 0)
        {
            return;
        }

        var targetIndex = sourceIndex + delta;
        if (targetIndex < 0 || targetIndex >= _playbackQueue.Count)
        {
            return;
        }

        var item = _playbackQueue[sourceIndex];
        _playbackQueue.RemoveAt(sourceIndex);
        _playbackQueue.Insert(targetIndex, item);

        if (_playbackIndex == sourceIndex)
        {
            _playbackIndex = targetIndex;
        }
        else if (delta < 0 && _playbackIndex >= targetIndex && _playbackIndex < sourceIndex)
        {
            _playbackIndex++;
        }
        else if (delta > 0 && _playbackIndex <= targetIndex && _playbackIndex > sourceIndex)
        {
            _playbackIndex--;
        }

        SyncQueueProjection();
    }

    private async void DebounceInboxReload()
    {
        _inboxSearchDebounceCts?.Cancel();
        _inboxSearchDebounceCts?.Dispose();
        _inboxSearchDebounceCts = new CancellationTokenSource();
        var token = _inboxSearchDebounceCts.Token;

        try
        {
            await Task.Delay(350, token);
            if (token.IsCancellationRequested)
            {
                return;
            }

            await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
        }
        catch (TaskCanceledException)
        {
            // Ignore canceled debounce runs.
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

    private void RefreshDownloadTasks()
    {
        var allTasks = _downloadService.GetTasks();
        IEnumerable<DownloadTaskItem> query = allTasks;
        if (!string.Equals(DownloadStatusFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(item => string.Equals(item.Status.ToString(), DownloadStatusFilter, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(DownloadSearchText))
        {
            var keyword = DownloadSearchText.Trim();
            query = query.Where(item => item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        DownloadTasks.Clear();
        foreach (var item in query)
        {
            DownloadTasks.Add(item);
        }

        OnPropertyChanged(nameof(DownloadSummary));
        OnPropertyChanged(nameof(DownloadStatusSummary));
    }

    private static bool TryGetLocalSettingBool(string key)
    {
        try
        {
            return ApplicationData.Current.LocalSettings.Values.TryGetValue(key, out var value)
                && value is bool parsed
                && parsed;
        }
        catch
        {
            return false;
        }
    }

    private static void TrySetLocalSetting(string key, object value)
    {
        try
        {
            ApplicationData.Current.LocalSettings.Values[key] = value;
        }
        catch
        {
            // Ignore settings persistence errors when running unpackaged.
        }
    }

    private static int? ParsePositiveIntOrNull(string? raw)
    {
        if (!int.TryParse(raw, out var parsed) || parsed <= 0)
        {
            return null;
        }

        return parsed;
    }

    private static int? ParseIntOrNull(string? raw)
    {
        if (!int.TryParse(raw, out var parsed))
        {
            return null;
        }

        return parsed;
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
