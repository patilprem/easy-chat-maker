import React, { createContext, useContext } from 'react';
import { backgroundCss, hasCustomBackground } from '../../lib/backgrounds';
import type { ChatProject } from '../../lib/parser/types';

/**
 * The chat wallpaper, painted BEHIND the message feed rather than inside it.
 *
 * Mounting it outside `.phone-chat-scroll` is deliberate:
 *  - it stays put while messages scroll over it, which is what WhatsApp,
 *    Telegram, Instagram and Messenger all do;
 *  - the PNG exporter's scroll freezing and the video exporter's message-layer
 *    detection both work strictly INSIDE the feed, so neither has to know this
 *    element exists.
 */

/**
 * Full-chat PNG export renders one very tall screen. A gradient stretches over
 * that height fine, but a photo would end up absurdly zoomed, so the photo is
 * repeated once per screen height instead — the same way a stitched scrolling
 * screenshot looks on a real phone. The exporter publishes the screen height
 * here; everywhere else this stays 0 and the photo simply covers the feed.
 */
const BackgroundTileContext = createContext(0);

export const BackgroundTileProvider = BackgroundTileContext.Provider;

/** Enough tiles to cover any realistic export; the container clips the rest. */
const MAX_TILES = 60;

export const ChatBackgroundLayer: React.FC<{ project: ChatProject }> = ({ project }) => {
  const tileHeight = useContext(BackgroundTileContext);

  if (!hasCustomBackground(project)) return null;

  const imageUrl = project.background?.imageUrl;
  const dim = project.background?.dim ?? 0;
  const css = backgroundCss(project);

  return (
    // `z-0` matters: an absolutely positioned element paints ABOVE in-flow
    // siblings, so without it the wallpaper covered the feed it is meant to sit
    // behind — hiding the scroll bar and any unpositioned row (date chips) on
    // the platforms whose feed is not itself positioned. The feed opts into
    // `relative z-[1]` to stay on top.
    <div data-chat-background className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {imageUrl ? (
        tileHeight > 0 ? (
          <div className="absolute inset-x-0 top-0 flex flex-col">
            {Array.from({ length: MAX_TILES }, (_, i) => (
              <div
                key={i}
                className="w-full flex-none"
                style={{
                  height: tileHeight,
                  backgroundImage: `url('${imageUrl}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ))}
          </div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${imageUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )
      ) : (
        <div className="absolute inset-0" style={{ background: css }} />
      )}

      {dim > 0 && (
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />
      )}
    </div>
  );
};
