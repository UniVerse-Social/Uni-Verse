import React, { useState, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import { FaHome, FaSearch, FaUser, FaUsers, FaGamepad, FaEnvelope } from 'react-icons/fa';
import { AuthContext } from '../App';
import { useDMDrawer } from '../context/DMDrawerContext';

const MOBILE_BREAKPOINT = '600px'; // when the logo “hits” the nav on small screens

/* ——— Mobile-only top logo bar ——— */
const MobileTopBar = styled.div`
  display: none;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: flex;
    align-items: center;
   height: calc(56px + env(safe-area-inset-top, 0px));
   padding: env(safe-area-inset-top, 0px) 16px 0;
   position: fixed;
   top: 0; left: 0; right: 0;
   z-index: 1001;
   background: var(--container-white);
   border-bottom: 1px solid var(--border-color);
   transform: translateZ(0);
   will-change: transform;
  }
`;

const MobileLogo = styled(NavLink)`
  font-size: 22px;
  font-weight: 800;
  color: #0d2d7d;
  text-decoration: none;
`;

const OrangeText = styled.span`
  color: var(--primary-orange);
`;

/* ——— Floating DM pill (stays top-right) ——— */
const DMButton = styled.button`
  position: fixed;
  top: 8px;
  right: 18px;
  z-index: 1100;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: var(--text-color);
  color: var(--container-white);
  display: grid;
  place-items: center;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  transition: transform .15s ease, filter .15s ease;
  border: none;
  cursor: pointer;
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
  background: #e02424;
  color: var(--container-white);
  font-size: 12px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border: 2px solid var(--container-white);
`;

 const DesktopOffset = styled.div`
   height: 60px;
   @media (max-width: ${MOBILE_BREAKPOINT}) { display: none; }
 `;
 const MobileTopOffset = styled.div`
   display: none;
   @media (max-width: ${MOBILE_BREAKPOINT}) {
     display: block;
     height: 56px; /* same as MobileTopBar */
   }
 `;

const NavWrapper = styled.nav`
  background-color: var(--container-white);
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000; 

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    height: 58px;
    border-bottom: 0;
    border-top: 1px solid var(--border-color);
    padding: 0 8px;
    box-shadow: 0 -6px 18px rgba(0,0,0,0.06);
    /* iOS safe area so icons don’t sit on the home bar */
    padding-bottom: calc(env(safe-area-inset-bottom, 0px));
  }
`;

const NavContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 975px;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    max-width: none;
    justify-content: center;
  }
`;

const Logo = styled(NavLink)`
  font-size: 27px;
  font-weight: bold;
  text-decoration: none;
  color: #0d2d7d;
  position: absolute;
  left: 20px;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    display: none; /* we show the logo in the MobileTopBar on phones */
  }
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 25px;
  margin-left: auto;
  margin-right: auto;

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    width: 100%;
    max-width: 520px;
    gap: 0;
    justify-content: space-around;
    margin: 0;
  }
`;

const StyledNavLink = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #111111;
  &.active { color: #0d2d7d; }
  &:hover { transform: translateY(-1px); filter: brightness(1.05); }

  @media (max-width: ${MOBILE_BREAKPOINT}) {
    font-size: 22px;
    padding: 10px 12px;
  }
`;

const AIIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #111111;
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.4px;
`;

const Navbar = () => {
  const [unread] = useState(0);
  const { user } = useContext(AuthContext);
  const { open } = useDMDrawer();
  if (!user) return null;

  return (
    <>
      {/* Mobile-only top logo bar */}
      <MobileTopBar>
        <MobileLogo to="/">
          Fullerton<OrangeText>Connect</OrangeText>
        </MobileLogo>
      </MobileTopBar>

      {/* Floating DM button (opens right drawer) */}
      <DMButton aria-label="Direct Messages" onClick={open}>
        <FaEnvelope />
        {unread > 0 && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
      </DMButton>

      <DesktopOffset />
      <MobileTopOffset />

      {/* Main nav – desktop top / mobile bottom */}
      <NavWrapper>
        <NavContainer>
          {/* Desktop-only logo (hidden on mobile) */}
          <Logo to="/">
            Fullerton<OrangeText>Connect</OrangeText>
          </Logo>

          <NavLinks>
            <StyledNavLink to="/" end><FaHome /></StyledNavLink>
            <StyledNavLink to="/titantap"><FaSearch /></StyledNavLink>
            <StyledNavLink to="/clubs"><FaUsers /></StyledNavLink>
            <StyledNavLink to="/ai"><AIIcon>AI</AIIcon></StyledNavLink>
            <StyledNavLink to="/games"><FaGamepad /></StyledNavLink>
            <StyledNavLink to={`/profile/${user.username}`}><FaUser /></StyledNavLink>
          </NavLinks>
        </NavContainer>
      </NavWrapper>
    </>
  );
};

export default Navbar;
