import React, { useState, useContext, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import { FaHome, FaSearch, FaUser, FaUsers, FaGamepad } from 'react-icons/fa';
import { AuthContext } from '../App';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FaEnvelope } from 'react-icons/fa';

const NavWrapper = styled.nav`
  background-color: var(--container-white);
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  position: sticky;
  top: 0;
  z-index: 1000;
`;

const NavContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 975px;
`;

const DMButton = styled(Link)`
  position: fixed;
  top: 8px;                /* top-right of the page */
  right: 18px;
  z-index: 1100;
  width: 42px;
  height: 42px;
  border-radius: 999px;

  /* THEME-AWARE contrast pill */
  background: var(--text-color);
  color: var(--container-white);

  display: grid;
  place-items: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  transition: transform .15s ease, filter .15s ease;
  &:hover { transform: translateY(-1px); filter: brightness(1.05); }
`;

const Badge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #e02424;                     /* alert red works in both themes */
  color: var(--container-white);
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid var(--container-white); /* ring matches theme surface */
`;

const Logo = styled(NavLink)`
  font-size: 27px;
  font-weight: bold;
  text-decoration: none;
  color: #0d2d7d;
  position: absolute;
  left: 20px;
`;

const OrangeText = styled.span`
  color: var(--primary-orange);
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 25px;
  margin-left: auto;
  margin-right: auto;
`;

const StyledNavLink = styled(NavLink)`
  font-size: 24px;
  color: #111111;
  &.active { color: '#0d2d7d'; }
  &:hover { transform: translateY(-1px); filter: brightness(1.05); }
`;

const Navbar = () => {
  const [unread, setUnread] = useState(0);
  const { user } = useContext(AuthContext);
  if (!user) return null;

  return (
    <NavWrapper>
      <NavContainer>
        <DMButton to="/dms" aria-label="Direct Messages">
          <FaEnvelope />
          {unread > 0 && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
        </DMButton>
        
        <Logo to="/">
          Fullerton<OrangeText>Connect</OrangeText>
        </Logo>
        <NavLinks>
          {/* `end` ensures only exact "/" marks Home active */}
          <StyledNavLink to="/" end><FaHome /></StyledNavLink>
          <StyledNavLink to="/titantap"><FaSearch /></StyledNavLink>
          <StyledNavLink to="/clubs"><FaUsers /></StyledNavLink>
          {/* Marketplace moved to Clubs sub-nav; use Games icon here */}
          <StyledNavLink to="/games"><FaGamepad /></StyledNavLink>
          <StyledNavLink to={`/profile/${user.username}`}><FaUser /></StyledNavLink>
        </NavLinks>
      </NavContainer>
    </NavWrapper>
  );
};

export default Navbar;
