import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';
import { FaHome, FaSearch, FaUser, FaUsers, FaGamepad } from 'react-icons/fa';
import { AuthContext } from '../App';

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

const Logo = styled(NavLink)`
  font-size: 24px;
  font-weight: bold;
  text-decoration: none;
  color: var(--primary-blue);
`;

const OrangeText = styled.span`
  color: var(--primary-orange);
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 25px;
`;

const StyledNavLink = styled(NavLink)`
  font-size: 24px;
  color: #8e8e8e;
  &.active { color: var(--primary-blue); }
`;

const Navbar = () => {
  const { user } = useContext(AuthContext);
  if (!user) return null;

  return (
    <NavWrapper>
      <NavContainer>
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
          {/* DM icon removed from navbar */}
        </NavLinks>
      </NavContainer>
    </NavWrapper>
  );
};

export default Navbar;
