// client/src/components/UserLink.jsx
import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const A = styled(Link)`
  color: inherit;
  font-weight: 700;
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

export default function UserLink({ username, children, className, onClick }) {
  if (!username) return children || null;
  return (
    <A
      className={className}
      onClick={onClick}
      to={`/profile/${encodeURIComponent(username)}`}
      data-username-link={username}
    >
      {children ?? username}
    </A>
  );
}
