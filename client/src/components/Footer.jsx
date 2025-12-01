
// client/src/components/Footer.jsx
import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';

const Wrap = styled.footer`
  margin-top: ${({ $fixed }) => ($fixed ? 0 : '20px')};
  padding: 16px 12px;
  border-top: none;
  text-align: center;
  font-size: 14px;
  background: transparent;
  position: ${({ $fixed }) => ($fixed ? 'fixed' : 'static')};
  left: 0;
  right: 0;
  bottom: 0;
  width: 98%;
  z-index: 5;
`;

const FooterNav = styled.nav`
  display: inline-flex;
  align-items: center;
  gap: 12px;
`;

const Dot = styled.span`
  color: var(--text-color, #666);
  opacity: 0.6;
`;

const FooterLink = styled(Link)`
  color: var(--primary-orange);
  text-decoration: underline;
  &:hover { opacity: 0.9; }
`;

export default function Footer({ fixed = false }) {
  return (
    <Wrap $fixed={fixed}>
      <FooterNav aria-label="Legal links">
        <FooterLink to="/terms">Terms of Service</FooterLink>
        <Dot>·</Dot>
        <FooterLink to="/privacy">Privacy Policy</FooterLink>
        <Dot>·</Dot>
        <FooterLink to="/guidelines">Community Guidelines</FooterLink>
      </FooterNav>
    </Wrap>
  );
}