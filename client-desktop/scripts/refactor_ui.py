import re
import os

MAIN_CONTENT = r"src\HoYoMusic.Desktop.App\Controls\HoYoMainContent.xaml"
PLAYER_BAR = r"src\HoYoMusic.Desktop.App\Controls\HoYoPlayerBar.xaml"
TITLE_BAR = r"src\HoYoMusic.Desktop.App\Controls\HoYoTitleBar.xaml"

def refactor_main_content():
    with open(MAIN_CONTENT, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Refactor Discover Section Random Tracks list actions
    random_track_buttons = r'<Button Grid\.Column="1" Content="播放" Command="\{Binding DataContext\.PlayRandomTrackCommand[^>]+/>\s*<Button Grid\.Column="2" Content="详情" Command="\{Binding DataContext\.OpenDiscoverTrackDetailCommand[^>]+/>\s*<Button Grid\.Column="3" Content="收藏" Command="\{Binding DataContext\.ToggleFavoriteForDiscoverTrackCommand[^>]+/>\s*<Button Grid\.Column="4" Content="队列" Command="\{Binding DataContext\.EnqueueDiscoverTrackCommand[^>]+/>\s*<Button Grid\.Column="5" Content="下首" Command="\{Binding DataContext\.PlayDiscoverTrackNextCommand[^>]+/>'

    replacement_random = '''<Button Grid.Column="1" Content="▶" Command="{Binding DataContext.PlayRandomTrackCommand, ElementName=RootGrid}" CommandParameter="{Binding}" Style="{StaticResource CircleActionButtonStyle}" Width="32" Height="32" Padding="0"/>
<Button Grid.Column="2" FontFamily="Segoe MDL2 Assets" Content="&#xE712;" Style="{StaticResource SecondaryButtonStyle}" Width="32" Height="32" Padding="0" Background="Transparent" BorderThickness="0">
    <Button.Flyout>
        <MenuFlyout>
            <MenuFlyoutItem Text="详情" Command="{Binding DataContext.OpenDiscoverTrackDetailCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
            <MenuFlyoutItem Text="收藏" Command="{Binding DataContext.ToggleFavoriteForDiscoverTrackCommand, ElementName=RootGrid}" CommandParameter="{Binding}" IsEnabled="{Binding DataContext.IsAuthenticated, ElementName=RootGrid}"/>
            <MenuFlyoutItem Text="加到队列" Command="{Binding DataContext.EnqueueDiscoverTrackCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
            <MenuFlyoutItem Text="下一首播放" Command="{Binding DataContext.PlayDiscoverTrackNextCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
        </MenuFlyout>
    </Button.Flyout>
</Button>'''
    content = re.sub(random_track_buttons, replacement_random, content)

    # 2. Refactor Top Tracks list actions
    top_track_buttons = r'<Button Grid\.Column="1" Content="播放" Command="\{Binding DataContext\.PlayTopTrackCommand[^>]+/>\s*<Button Grid\.Column="2" Content="详情" Command="\{Binding DataContext\.OpenDiscoverTrackDetailCommand[^>]+/>\s*<Button Grid\.Column="3" Content="收藏" Command="\{Binding DataContext\.ToggleFavoriteForDiscoverTrackCommand[^>]+/>\s*<Button Grid\.Column="4" Content="队列" Command="\{Binding DataContext\.EnqueueDiscoverTrackCommand[^>]+/>\s*<Button Grid\.Column="5" Content="下首" Command="\{Binding DataContext\.PlayDiscoverTrackNextCommand[^>]+/>'

    replacement_top = replacement_random.replace("PlayRandomTrackCommand", "PlayTopTrackCommand")
    content = re.sub(top_track_buttons, replacement_top, content)


    # 3. Refactor Album track list Actions
    album_track_buttons = r'<Button Grid\.Column="2" Content="播放" Command="\{Binding DataContext\.PlayAlbumTrackRowCommand[^>]+/>\s*<StackPanel Grid\.Column="3" Orientation="Horizontal" Spacing="6" VerticalAlignment="Center">\s*<Button Content="详情" Command="\{Binding DataContext\.OpenAlbumTrackDetailCommand[^>]+/>\s*<TextBlock Foreground="\{StaticResource TextSecondaryBrush\}" VerticalAlignment="Center" Text="\{Binding DurationDisplay\}" />\s*</StackPanel>'

    replacement_album = '''<Button Grid.Column="2" Content="▶" Command="{Binding DataContext.PlayAlbumTrackRowCommand, ElementName=RootGrid}" CommandParameter="{Binding}" Style="{StaticResource CircleActionButtonStyle}" Width="32" Height="32" Padding="0"/>
<StackPanel Grid.Column="3" Orientation="Horizontal" Spacing="6" VerticalAlignment="Center">
    <TextBlock Foreground="{StaticResource TextSecondaryBrush}" VerticalAlignment="Center" Text="{Binding DurationDisplay}" Margin="0,0,8,0" />
    <Button FontFamily="Segoe MDL2 Assets" Content="&#xE712;" Style="{StaticResource SecondaryButtonStyle}" Width="32" Height="32" Padding="0" Background="Transparent" BorderThickness="0">
        <Button.Flyout>
            <MenuFlyout>
                <MenuFlyoutItem Text="详情" Command="{Binding DataContext.OpenAlbumTrackDetailCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
            </MenuFlyout>
        </Button.Flyout>
    </Button>
</StackPanel>'''
    content = re.sub(album_track_buttons, replacement_album, content)

    # 4. Refactor Public Library List actions
    lib_track_buttons = r'<Button Grid\.Column="2" Content="▶" Command="\{Binding DataContext\.PlayPublicTrackRowCommand[^>]+/>\s*<Button Grid\.Column="3" Content="收藏"[^>]+/>\s*<Button Grid\.Column="4" Content="加歌单"[^>]+/>\s*<Button Grid\.Column="5" Content="队列"[^>]+/>\s*<Button Grid\.Column="6" Content="下首"[^>]+/>\s*<Button Grid\.Column="7" Content="下载"[^>]+/>\s*<Button Grid\.Column="8" Content="详情"[^>]+/>'

    replacement_lib = '''<Button Grid.Column="2" Content="▶" Command="{Binding DataContext.PlayPublicTrackRowCommand, ElementName=RootGrid}" CommandParameter="{Binding}" Style="{StaticResource CircleActionButtonStyle}" Width="32" Height="32" Padding="0" VerticalAlignment="Center"/>
<Button Grid.Column="3" FontFamily="Segoe MDL2 Assets" Content="&#xE712;" Style="{StaticResource SecondaryButtonStyle}" Width="32" Height="32" Padding="0" Background="Transparent" BorderThickness="0" VerticalAlignment="Center">
    <Button.Flyout>
        <MenuFlyout>
            <MenuFlyoutItem Text="详情" Command="{Binding DataContext.OpenTrackDetailCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
            <MenuFlyoutItem Text="收藏" Command="{Binding DataContext.ToggleFavoriteForPublicTrackCommand, ElementName=RootGrid}" CommandParameter="{Binding}" IsEnabled="{Binding DataContext.IsAuthenticated, ElementName=RootGrid}"/>
            <MenuFlyoutItem Text="加歌单" Command="{Binding DataContext.AddPublicTrackToPlaylistCommand, ElementName=RootGrid}" CommandParameter="{Binding}" IsEnabled="{Binding DataContext.IsAuthenticated, ElementName=RootGrid}"/>
            <MenuFlyoutItem Text="加到队列" Command="{Binding DataContext.EnqueuePublicTrackCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
            <MenuFlyoutItem Text="下一首播放" Command="{Binding DataContext.PlayNowNextInQueueCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
            <MenuFlyoutItem Text="下载" Command="{Binding DataContext.DownloadPublicTrackCommand, ElementName=RootGrid}" CommandParameter="{Binding}"/>
        </MenuFlyout>
    </Button.Flyout>
</Button>'''
    content = re.sub(lib_track_buttons, replacement_lib, content)

    # 5. Fix navigation bar
    nav_buttons = r'<Button x:Name="DiscoverNavButton" Content="发现" Command="\{Binding OpenSectionCommand\}" CommandParameter="discover" Style="\{StaticResource SecondaryButtonStyle\}" />\s*<Button x:Name="GamesNavButton" Content="游戏" Command="\{Binding OpenSectionCommand\}" CommandParameter="games" Style="\{StaticResource SecondaryButtonStyle\}" />.*?(?=<Button x:Name="AdminNavButton")'

    with open(MAIN_CONTENT, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Main Content refactored successfully.")

def refactor_player_bar():
    with open(PLAYER_BAR, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Bundle some small buttons into icons
    content = content.replace('Content="曲目详情"', 'Content="&#xE8B0;" FontFamily="Segoe MDL2 Assets" AutomationProperties.Name="曲目详情"')
    content = content.replace('Content="队列"', 'Content="&#xE8FD;" FontFamily="Segoe MDL2 Assets" AutomationProperties.Name="队列"')
    content = content.replace('Content="睡眠"', 'Content="&#xE708;" FontFamily="Segoe MDL2 Assets" AutomationProperties.Name="睡眠"')
    content = content.replace('Content="增强"', 'Content="&#xE7E8;" FontFamily="Segoe MDL2 Assets" AutomationProperties.Name="增强"')
    content = content.replace('Content="AB循环"', 'Content="&#xE8EE;" FontFamily="Segoe MDL2 Assets" AutomationProperties.Name="AB循环"')

    with open(PLAYER_BAR, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Player Bar refactored successfully.")

if __name__ == "__main__":
    refactor_main_content()
    refactor_player_bar()
