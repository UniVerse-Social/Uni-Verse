import styled from 'styled-components';

export const CountBadge = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: #4b5563;
`;

export const Hint = styled.div`
  font-size: 13px;
  color: #6b7280;
`;

export const LimitNote = styled.div`
  font-size: 13px;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 10px;
  padding: 8px 10px;
`;

export const HobbyGrid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
`;

export const HobbyOption = styled.button`
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid ${p => (p.$selected ? '#2563eb' : 'var(--border-color)')};
  background: ${p => (p.$selected ? 'rgba(37, 99, 235, 0.1)' : 'var(--container-white)')};
  color: var(--text-color);
  text-align: left;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.2s ease;
  box-shadow: ${p => (p.$selected ? '0 4px 10px rgba(37,99,235,0.16)' : 'none')};
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

export const HobbyEmoji = styled.span`
  font-size: 18px;
  line-height: 1;
`;

export const HobbyText = styled.span`
  font-size: 12px;
  font-weight: 600;
`;
