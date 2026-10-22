import { Fragment, type CSSProperties } from 'react';
import type { Segment } from '@/types/model';
import { cashtagUrl, hashtagUrl, linkLabel, profileUrl, safeHref } from '@/utils/url';

function ExtLink({ href, children }: { href: string | null; children: string }) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-accent hover:underline underline-offset-2"
    >
      {children}
    </a>
  );
}

/** Renders structured post text. React escapes all text; only http(s) URLs become links. */
export function RichText({
  segments,
  className,
  style,
}: {
  segments: Segment[];
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...style }}
    >
      {segments.map((s, i) => {
        switch (s.t) {
          case 'text':
            if (s.b && s.i)
              return (
                <strong key={i}>
                  <em>{s.v}</em>
                </strong>
              );
            if (s.b) return <strong key={i}>{s.v}</strong>;
            if (s.i) return <em key={i}>{s.v}</em>;
            return <Fragment key={i}>{s.v}</Fragment>;
          case 'link':
            return (
              <ExtLink key={i} href={safeHref(s.href)}>
                {linkLabel(s.v, s.href)}
              </ExtLink>
            );
          case 'mention':
            return (
              <ExtLink key={i} href={profileUrl(s.handle)}>
                {s.v}
              </ExtLink>
            );
          case 'hashtag':
            return (
              <ExtLink key={i} href={hashtagUrl(s.tag)}>
                {s.v}
              </ExtLink>
            );
          case 'cashtag':
            return (
              <ExtLink key={i} href={cashtagUrl(s.tag)}>
                {s.v}
              </ExtLink>
            );
        }
      })}
    </div>
  );
}
