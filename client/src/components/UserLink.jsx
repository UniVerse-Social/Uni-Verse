// client/src/components/UserLink.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Wrap = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 6px;

  a {
    color: inherit;
    text-decoration: none;
    font-weight: 800;
  }
`;

const TitleBadge = styled.span`
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #111;
  border: 1px solid var(--border-color);
  transform: translateY(1px); /* sits nicer on the baseline */
`;

const cache = new Map(); // username -> titleBadge string | null

/**
 * UserLink
 * Props:
 *  - username (string): required
 *  - children (node): optional custom label (defaults to username)
 *  - titleBadge (string): optional pre-fetched/known title badge; skips the fetch
 *  - hideBadge (bool): optional to suppress the badge in specific places
 */
export default function UserLink({ username, children, titleBadge, hideBadge = false }) {
  const [title, setTitle] = React.useState(titleBadge ?? null);

  React.useEffect(() => {
    let mounted = true;
    if (!username || hideBadge || titleBadge != null) return;

    const hit = cache.get(username);
    if (hit !== undefined) {
      if (mounted) setTitle(hit);
      return;
    }

    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/users/profile/${encodeURIComponent(username)}`);
        const t =
          data?.titleBadge ??
          (Array.isArray(data?.badgesEquipped) ? data.badgesEquipped[0] : null) ??
          null;
        cache.set(username, t);
        if (mounted) setTitle(t);
      } catch {
        cache.set(username, null);
        if (mounted) setTitle(null);
      }
    })();

    return () => { mounted = false; };
  }, [username, hideBadge, titleBadge]);

  return (
    <Wrap>
      <Link to={`/profile/${username}`}>{children || username}</Link>
      {!hideBadge && !!(titleBadge ?? title) && (
        <TitleBadge aria-label="Title badge">{titleBadge ?? title}</TitleBadge>
      )}
    </Wrap>
  );
}
