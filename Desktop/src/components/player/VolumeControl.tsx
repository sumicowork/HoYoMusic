import { useState } from 'react';
import { Slider } from 'antd';
import { MutedOutlined, SoundOutlined } from '@ant-design/icons';
import { IconButton, cn } from '@/components/ui';
import { usePlayerStore } from '@/store/playerStore';

export interface VolumeControlProps {
  className?: string;
}

/**
 * Volume slider bound to `store.volume` (0..1). Includes a mute toggle that
 * remembers the previous level so un-muting restores it.
 */
export function VolumeControl({ className }: VolumeControlProps) {
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const [prevVolume, setPrevVolume] = useState(volume || 1);

  const muted = volume <= 0;
  const Icon = muted ? MutedOutlined : SoundOutlined;

  const toggleMute = () => {
    if (muted) {
      setVolume(prevVolume || 1);
    } else {
      setPrevVolume(volume);
      setVolume(0);
    }
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <IconButton
        aria-label={muted ? '取消静音' : '静音'}
        variant="ghost"
        size="sm"
        icon={<Icon />}
        onClick={toggleMute}
      />
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(v) => setVolume(v as number)}
        tooltip={{ open: false }}
        className="!w-24"
        styles={{
          track: { background: 'var(--accent)' },
          handle: {
            borderColor: 'var(--accent)',
            background: 'var(--accent)',
            opacity: 1,
          },
        }}
      />
    </div>
  );
}

export default VolumeControl;
