import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { trackAdImpression, trackAdClick } from '../api';

const Wrap = styled.div`
  background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,.12);
  padding:14px; margin-bottom:20px; display:flex; gap:12px; align-items:center;
`;
const Img = styled.img`
  width:72px; height:72px; border-radius:8px; object-fit:cover; background:#f4f4f4;
`;
const Title = styled.div`font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
const Body = styled.div`font-size:14px; color:#444;`;
const Btn = styled.a`
  margin-left:auto; padding:8px 12px; border-radius:8px; background:#111; color:#fff; text-decoration:none;
`;
const Chip = styled.span`
  font-size:11px; color:#6b7280; background:#f3f4f6; border:1px solid #e5e7eb; padding:2px 6px; border-radius:999px;
`;

export default function AdCard({ ad }){
  const ref = useRef(null);
  const [impTracked, setImpTracked] = useState(false);

  const id = ad?.id || ad?._id || 'dev-fallback';
  const imageUrl = ad?.imageUrl || ad?.image || '';
  const title = ad?.title || 'Sponsored';
  const body = ad?.body || '';
  const ctaText = ad?.ctaText || 'Learn more';
  const ctaUrl = ad?.ctaUrl || '';
  const demo = !!ad?.testOnly || id === 'dev-fallback';

  useEffect(() => {
    if (!ref.current || impTracked) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setImpTracked(true);
        trackAdImpression(id);
      }
    }, { threshold: 0.5 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [id, impTracked]);

  const handleClick = () => trackAdClick(id);

  return (
    <Wrap ref={ref} role="article" aria-label="Sponsored" data-feed-item="ad">
      {imageUrl ? <Img src={imageUrl} alt={title} /> : <Img alt="" />}
      <div style={{flex:1, minWidth:0}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <Chip>{demo ? 'Sponsored • Demo' : 'Sponsored'}</Chip>
          <Title title={title}>{title}</Title>
        </div>
        {body && <Body>{body}</Body>}
      </div>
      {ctaUrl && (
        <Btn href={ctaUrl} target="_blank" rel="nofollow noopener noreferrer" onClick={handleClick}>
          {ctaText}
        </Btn>
      )}
    </Wrap>
  );
}
