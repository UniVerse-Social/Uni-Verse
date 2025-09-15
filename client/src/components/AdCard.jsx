import React from 'react';
import styled from 'styled-components';

const Wrap = styled.div`
  background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,.12);
  padding:14px; margin-bottom:20px; display:flex; gap:12px; align-items:center;
`;
const Img = styled.img`width:72px; height:72px; border-radius:8px; object-fit:cover; background:#f4f4f4;`;
const Title = styled.div`font-weight:700;`;
const Body = styled.div`font-size:14px; color:#444;`;
const Btn = styled.a`margin-left:auto; padding:8px 12px; border-radius:8px; background:#111; color:#fff; text-decoration:none;`;

export default function AdCard({ ad }){
  return (
    <Wrap role="article" aria-label="Sponsored">
      {ad.image ? <Img src={ad.image} alt={ad.title || 'Ad'} /> : <Img alt="" />}
      <div style={{flex:1}}>
        <Title>{ad.title || 'Sponsored'}</Title>
        {ad.body && <Body>{ad.body}</Body>}
      </div>
      {ad.ctaUrl && <Btn href={ad.ctaUrl} target="_blank" rel="noopener noreferrer">{ad.ctaText || 'Learn more'}</Btn>}
    </Wrap>
  );
}
