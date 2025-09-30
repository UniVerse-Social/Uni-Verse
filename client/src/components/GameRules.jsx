// src/components/GameRules.jsx
import React from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed; inset:0; background: rgba(0,0,0,.28);
  display:flex; align-items:center; justify-content:center; z-index: 30;
`;

const Modal = styled.div`
  width: 540px; max-width: 94vw;
  max-height: 90vh;
  display: flex;              /* make room for a scrollable body */
  flex-direction: column;
  overflow: hidden;              
  background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,.18);
  border:1px solid #e5e7eb; padding:16px;
 `;

const Body = styled.div`
   flex: 1 1 auto;
   min-height: 0;                /* critical: lets the flex child shrink to enable scrolling */
   overflow-y: auto;
  margin-top: 10px;
  padding-right: 6px;                 /* keeps text clear of scrollbar */
  -webkit-overflow-scrolling: touch;  /* smooth on iOS */
  overscroll-behavior: contain;
`;

const ModalGrid = styled.div`
  display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px;
`;

export default function GameRules({
  title = 'Game Rules',
  subtitle = 'Quick basics with examples.',
  sections = [],
  buttonText = '📘 Rules',
  buttonTitle = 'Game Rules',
  buttonStyle,
  renderFooter,            // optional function
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Floating Rules button */}
      <button
        onClick={()=>setOpen(true)}
        title={buttonTitle}
        style={{
          position:'fixed', right:24, bottom:24, zIndex:20,
          border:'1px solid var(--border-color)', background:'#fff',
          borderRadius:12, padding:'8px 12px', boxShadow:'0 8px 24px rgba(0,0,0,.06)',
          cursor:'pointer', ...buttonStyle
        }}
      >{buttonText}</button>

      {/* Rules modal */}
      {open && (
        <Overlay onClick={()=>setOpen(false)}>
          <Modal onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18, fontWeight:800}}>{title}</div>
            {!!subtitle && <div style={{fontSize:13, color:'#6b7280', marginTop:4}}>{subtitle}</div>}

          <Body>
            <div style={{display:'grid', gap:10, fontSize:14}}>
              {sections.map((sec, i) => (
                <div key={i}>
                  {sec.heading && <div><b>{sec.heading}:</b></div>}
                  {sec.text && <div>{sec.text}</div>}
                  {Array.isArray(sec.list) && (
                    <ul style={{margin:'6px 0 0 18px'}}>
                      {sec.list.map((li, j)=><li key={j} style={{margin:'4px 0'}}>{li}</li>)}
                    </ul>
                  )}
                  {sec.note && <div style={{fontSize:12, color:'#6b7280', marginTop:6}}>{sec.note}</div>}
                </div>
             ))}
            </div>
          </Body>

            {typeof renderFooter === 'function' && (
              <ModalGrid style={{marginTop:12}}>
                {renderFooter({ close: () => setOpen(false) })}
              </ModalGrid>
            )}
          </Modal>
        </Overlay>
      )}
    </>
  );
}
