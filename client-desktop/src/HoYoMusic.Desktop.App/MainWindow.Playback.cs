using Microsoft.UI.Input;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;
using Windows.Media.Core;
using Windows.UI.Core;

namespace HoYoMusic.Desktop.App;

public sealed partial class MainWindow
{
    private int? _crossfadeTrackId;
    private bool _crossfadeTriggeredForTrack;
    private double _userVolumePercent = 100;

    private void ViewModelOnPlayRequested(object? sender, Uri streamUri)
    {
        try
        {
            PlayerElement.Source = MediaSource.CreateFromUri(streamUri);
            PlayerElement.MediaPlayer.Play();
            _crossfadeTrackId = ViewModel.CurrentTrackId;
            _crossfadeTriggeredForTrack = false;
            ApplyEffectiveVolume();
            UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Playing);
        }
        catch (Exception ex)
        {
            ViewModel.ErrorMessage = $"播放错误：{ex.Message}";
        }
    }

    private void ViewModelOnStopRequested(object? sender, EventArgs e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        mediaPlayer.Pause();
        PlayerElement.Source = null;
        _crossfadeTrackId = null;
        _crossfadeTriggeredForTrack = false;
        UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Paused);
        CurrentTimeText.Text = "0:00";
        DurationText.Text = "0:00";
    }

    private void PrevButton_OnClick(object sender, RoutedEventArgs e)
    {
        ViewModel.PlayPreviousCommand.Execute(null);
    }

    private void PlayPauseButton_OnClick(object sender, RoutedEventArgs e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        if (mediaPlayer.PlaybackSession.PlaybackState == Windows.Media.Playback.MediaPlaybackState.Playing)
        {
            mediaPlayer.Pause();
            UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Paused);
        }
        else
        {
            mediaPlayer.Play();
            UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState.Playing);
        }
    }

    private void NextButton_OnClick(object sender, RoutedEventArgs e)
    {
        ViewModel.PlayNextCommand.Execute(null);
    }

    private void VolumeSlider_OnValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        _userVolumePercent = e.NewValue;
        ApplyEffectiveVolume();

        if (e.NewValue > 0)
        {
            _lastNonZeroVolume = e.NewValue;
        }
    }

    private void MainWindow_OnKeyDown(object sender, KeyRoutedEventArgs e)
    {
        switch (e.Key)
        {
            case Windows.System.VirtualKey.Space:
                PlayPauseButton_OnClick(sender, new RoutedEventArgs());
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Left:
                if (IsControlPressed())
                {
                    SeekBySeconds(-5);
                }
                else
                {
                    PrevButton_OnClick(sender, new RoutedEventArgs());
                }
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Right:
                if (IsControlPressed())
                {
                    SeekBySeconds(5);
                }
                else
                {
                    NextButton_OnClick(sender, new RoutedEventArgs());
                }
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Up:
                VolumeSlider.Value = Math.Min(100, VolumeSlider.Value + 5);
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Down:
                VolumeSlider.Value = Math.Max(0, VolumeSlider.Value - 5);
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.M:
                if (Math.Abs(VolumeSlider.Value) < 0.01)
                {
                    VolumeSlider.Value = Math.Max(10, _lastNonZeroVolume);
                }
                else
                {
                    _lastNonZeroVolume = VolumeSlider.Value;
                    VolumeSlider.Value = 0;
                }
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.L:
                ViewModel.TogglePlayModeCommand.Execute(null);
                e.Handled = true;
                break;
            case Windows.System.VirtualKey.Escape:
                if (ViewModel.IsAlbumDetailSection)
                {
                    ViewModel.BackToDiscoverCommand.Execute(null);
                    e.Handled = true;
                }
                break;
        }
    }

    private void MediaPlayer_OnMediaEnded(Windows.Media.Playback.MediaPlayer sender, object args)
    {
        DispatcherQueue.TryEnqueue(() => ViewModel.HandleTrackEndedCommand.Execute(null));
    }

    private void PlaybackSession_OnPlaybackStateChanged(Windows.Media.Playback.MediaPlaybackSession sender, object args)
    {
        DispatcherQueue.TryEnqueue(() => UpdatePlayPauseGlyph(sender.PlaybackState));
    }

    private void UpdatePlayPauseGlyph(Windows.Media.Playback.MediaPlaybackState playbackState)
    {
        PlayPauseIcon.Glyph = playbackState == Windows.Media.Playback.MediaPlaybackState.Playing ? "\uE769" : "\uE768";
    }

    private void ProgressTimer_OnTick(object? sender, object e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        var session = mediaPlayer.PlaybackSession;
        var duration = session.NaturalDuration;
        if (duration.TotalSeconds > 0)
        {
            ProgressSlider.Maximum = duration.TotalSeconds;
            DurationText.Text = FormatTime(duration);
        }

        ApplyEffectiveVolume();

        if (_isScrubbingProgress)
        {
            return;
        }

        var position = session.Position;
        if (position.TotalSeconds >= 0)
        {
            if (ViewModel.IsAbLoopEnabled && ViewModel.AbLoopEndSeconds > ViewModel.AbLoopStartSeconds)
            {
                var loopStart = Math.Max(0, ViewModel.AbLoopStartSeconds);
                var loopEnd = Math.Max(loopStart + 1, ViewModel.AbLoopEndSeconds);
                if (position.TotalSeconds >= loopEnd)
                {
                    mediaPlayer.PlaybackSession.Position = TimeSpan.FromSeconds(loopStart);
                    position = mediaPlayer.PlaybackSession.Position;
                }
            }

            ProgressSlider.Value = Math.Min(ProgressSlider.Maximum, position.TotalSeconds);
            CurrentTimeText.Text = FormatTime(position);
            ViewModel.NotifyPlaybackProgress(position.TotalSeconds, duration.TotalSeconds > 0 ? duration.TotalSeconds : null);
            ViewModel.UpdateSpectrumBars(position.TotalSeconds, duration.TotalSeconds, Math.Clamp(_userVolumePercent / 100.0, 0, 1));

            if (ViewModel.CrossfadeEnabled
                && !_crossfadeTriggeredForTrack
                && _crossfadeTrackId.HasValue
                && ViewModel.CurrentTrackId == _crossfadeTrackId
                && duration.TotalSeconds > 0)
            {
                var remaining = duration.TotalSeconds - position.TotalSeconds;
                if (remaining <= Math.Max(1, ViewModel.CrossfadeSeconds))
                {
                    _crossfadeTriggeredForTrack = true;
                    ViewModel.PlayNextCommand.Execute(null);
                }
            }
        }
    }

    private void ProgressSlider_OnPointerPressed(object sender, PointerRoutedEventArgs e)
    {
        _isScrubbingProgress = true;
    }

    private void ProgressSlider_OnPointerReleased(object sender, PointerRoutedEventArgs e)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is not null)
        {
            mediaPlayer.PlaybackSession.Position = TimeSpan.FromSeconds(Math.Max(0, ProgressSlider.Value));
        }

        _isScrubbingProgress = false;
    }

    private void ProgressSlider_OnValueChanged(object sender, RangeBaseValueChangedEventArgs e)
    {
        if (e.NewValue >= 0)
        {
            CurrentTimeText.Text = FormatTime(TimeSpan.FromSeconds(e.NewValue));
        }
    }

    private static string FormatTime(TimeSpan value)
    {
        if (value.TotalHours >= 1)
        {
            return value.ToString("h\\:mm\\:ss");
        }

        return value.ToString("m\\:ss");
    }

    private static bool IsControlPressed()
    {
        var state = InputKeyboardSource.GetKeyStateForCurrentThread(Windows.System.VirtualKey.Control);
        return state.HasFlag(CoreVirtualKeyStates.Down);
    }

    private void SeekBySeconds(double deltaSeconds)
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        var session = mediaPlayer.PlaybackSession;
        var next = session.Position + TimeSpan.FromSeconds(deltaSeconds);
        if (next < TimeSpan.Zero)
        {
            next = TimeSpan.Zero;
        }

        if (session.NaturalDuration.TotalSeconds > 0 && next > session.NaturalDuration)
        {
            next = session.NaturalDuration;
        }

        session.Position = next;
    }

    private void ApplyEffectiveVolume()
    {
        var mediaPlayer = PlayerElement.MediaPlayer;
        if (mediaPlayer is null)
        {
            return;
        }

        var baseVolume = Math.Clamp(_userVolumePercent / 100.0, 0, 1);
        mediaPlayer.Volume = Math.Clamp(baseVolume * ViewModel.EqualizerGainFactor, 0, 1);
    }
}

