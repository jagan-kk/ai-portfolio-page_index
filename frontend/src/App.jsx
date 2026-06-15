import React from 'react';
import ChatBox from './components/ChatBox';

function App() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'flex-start', 
      height: '100vh', 
      background: '#0d0d0d',
      margin: 0,
      textAlign: 'left',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' 
    }}>
      <ChatBox />
    </div>
  );
}

export default App;