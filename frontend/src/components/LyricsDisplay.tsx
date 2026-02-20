import React, { useEffect, useState, useRef } from 'react';
import { Card, Empty } from 'antd';
import './LyricsDisplay.css';

interface LyricLine {
  time: number;
  text: string;
}

interface LyricsDisplayProps {
  lyricsContent: string | null;
  currentTime: number;
  onSeek?: (time: number) => void;
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ lyricsContent, currentTime, onSeek }) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lyricsContent) {
      parseLyrics(lyricsContent);
    }
  }, [lyricsContent]);

  useEffect(() => {
    if (lyrics.length > 0) {
      updateCurrentLine();
    }
  }, [currentTime, lyrics]);

  const parseLyrics = (content: string) => {
    const lines = content.split('\n');
    const parsed: LyricLine[] = [];

    lines.forEach(line => {
      // Match [mm:ss.xx] or [mm:ss] format
      const match = line.match(/\[(\d{2}):(\d{2})\.?(\d{2})?\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const centiseconds = match[3] ? parseInt(match[3]) : 0;
        const time = minutes * 60 + seconds + centiseconds / 100;
        const text = match[4].trim();

        if (text) {
          parsed.push({ time, text });
        }
      }
    });

    parsed.sort((a, b) => a.time - b.time);
    setLyrics(parsed);
  };

  const updateCurrentLine = () => {
    let index = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        index = i;
        break;
      }
    }
    setCurrentIndex(index);

    // Auto scroll to current line
    if (index >= 0 && lyricsRef.current) {
      const currentElement = lyricsRef.current.querySelector(`[data-index="${index}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  };

  const handleLineClick = (time: number) => {
    if (onSeek) {
      onSeek(time);
    }
  };

  if (!lyricsContent) {
    return (
      <Card className="lyrics-card">
        <Empty description="暂无歌词" />
      </Card>
    );
  }

  return (
    <Card className="lyrics-card" title="歌词">
      <div className="lyrics-container" ref={lyricsRef}>
        {lyrics.map((line, index) => (
          <div
            key={index}
            data-index={index}
            className={`lyrics-line ${index === currentIndex ? 'active' : ''} ${
              index < currentIndex ? 'passed' : ''
            } ${onSeek ? 'clickable' : ''}`}
            onClick={() => handleLineClick(line.time)}
            title={onSeek ? '点击跳转' : ''}
          >
            {line.text}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default LyricsDisplay;

