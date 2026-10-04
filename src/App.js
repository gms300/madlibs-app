import React, { useState, useEffect } from 'react';
import stories from './stories';

function App() {
  const [selectedStory, setSelectedStory] = useState(null);
  const [showStorySelection, setShowStorySelection] = useState(true);
  const [showIntro, setShowIntro] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [showStory, setShowStory] = useState(false);
  const [words, setWords] = useState({});

  useEffect(() => {
    if (stories.length === 1) {
      selectStory(stories[0]);
    }
  }, []);

  const selectStory = (story) => {
    setSelectedStory(story);
    setShowStorySelection(false);
    setShowIntro(true);
    const initialWords = {};
    story.fields.forEach(field => {
      initialWords[field.key] = '';
    });
    setWords(initialWords);
    setCurrentPage(0);
    setShowStory(false);
  };

  const fields = selectedStory?.fields || [];

  const renderStory = (template, answers) => {
    let result = template;
    Object.entries(answers).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });
    return result;
  };

  const story = selectedStory ? renderStory(selectedStory.template, words) : '';

  const handleSelectAnswer = (answer) => {
    setWords(prev => ({ ...prev, [fields[currentPage].key]: answer }));
  };

  const handleNext = () => {
    if (showIntro) {
      setShowIntro(false);
      setCurrentPage(0);
    } else if (currentPage < fields.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      setShowStory(true);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePlayAgain = () => {
    setShowIntro(true);
    setCurrentPage(0);
    setShowStory(false);
    const initialWords = {};
    fields.forEach(field => {
      initialWords[field.key] = '';
    });
    setWords(initialWords);
  };

  if (showStorySelection) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            marginTop: 0,
            marginBottom: '1rem',
            color: '#333'
          }}>🎪 MadLibs! 🎪</h1>

          <p style={{
            fontSize: '18px',
            color: '#666',
            marginTop: 0,
            marginBottom: '2rem'
          }}>
            Pick a story to get started!
          </p>

          <div style={{
            display: 'grid',
            gap: '12px'
          }}>
            {stories.map(s => (
              <button
                key={s.id}
                onClick={() => selectStory(s)}
                style={{
                  padding: '18px 16px',
                  fontSize: '20px',
                  fontWeight: 600,
                  border: '2px solid #ddd',
                  borderRadius: '12px',
                  background: 'white',
                  color: '#333',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f9f9f9';
                  e.target.style.borderColor = '#667eea';
                  e.target.style.transform = 'translateX(5px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#ddd';
                  e.target.style.transform = 'translateX(0)';
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{s.title}</div>
                <div style={{ fontSize: '14px', color: '#999' }}>{s.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showStory) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 700,
            marginTop: 0,
            marginBottom: '1.5rem',
            color: '#333'
          }}>✨ Your Story! ✨</h1>

          <p style={{
            fontSize: '24px',
            lineHeight: '1.8',
            color: '#333',
            marginBottom: '2rem',
            fontFamily: 'Georgia, serif'
          }}>
            {story}
          </p>

          <button
            onClick={handlePlayAgain}
            style={{
              width: '100%',
              padding: '20px 16px',
              backgroundColor: '#667eea',
              border: 'none',
              borderRadius: '15px',
              fontSize: '24px',
              fontWeight: 700,
              cursor: 'pointer',
              color: 'white',
              transition: 'transform 0.2s, box-shadow 0.2s',
              marginBottom: '12px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 5px 20px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
          >
            🎮 Play Again! 🎮
          </button>

          <button
            onClick={() => {
              setShowStorySelection(true);
              setSelectedStory(null);
            }}
            style={{
              width: '100%',
              padding: '20px 16px',
              backgroundColor: '#764ba2',
              border: 'none',
              borderRadius: '15px',
              fontSize: '24px',
              fontWeight: 700,
              cursor: 'pointer',
              color: 'white',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 5px 20px rgba(118, 75, 162, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
          >
            📚 Choose Another Story 📚
          </button>
        </div>
      </div>
    );
  }

  if (showIntro && !showStory) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 700,
            marginTop: 0,
            marginBottom: '0.5rem',
            color: '#333'
          }}>🎪 MadLibs! 🎪</h1>
          <p style={{
            fontSize: '20px',
            color: '#666',
            marginTop: 0,
            marginBottom: '2rem'
          }}>{selectedStory?.title}</p>

          <p style={{
            fontSize: '18px',
            color: '#333',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}>
            Get ready to create the silliest, funniest story ever! Pick one word at a time and see what happens.
          </p>

          <button
            onClick={handleNext}
            style={{
              width: '100%',
              padding: '20px 16px',
              backgroundColor: '#667eea',
              border: 'none',
              borderRadius: '15px',
              fontSize: '24px',
              fontWeight: 700,
              cursor: 'pointer',
              color: 'white',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 5px 20px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = 'none';
            }}
          >
            Let's Go! →
          </button>
        </div>
      </div>
    );
  }

  const field = fields[currentPage];
  const currentAnswer = words[field.key];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* Top: Static Question */}
      <div style={{
        flexShrink: 0,
        textAlign: 'center',
        marginBottom: '1rem',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '15px',
        padding: '1.5rem',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
      }}>
        <p style={{
          fontSize: '16px',
          color: '#999',
          marginTop: 0,
          marginBottom: '0.5rem'
        }}>
          Question {currentPage + 1} of {fields.length}
        </p>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#333',
          marginTop: 0,
          marginBottom: 0
        }}>
          {field.prompt}
        </h2>
      </div>

      {/* Middle: Scrollable Choices in 2 Columns */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        margin: '1rem 0',
        scrollbarGutter: 'stable',
        paddingRight: '0.5rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px'
        }}>
          {field.options.map(option => (
            <button
              key={option}
              onClick={() => handleSelectAnswer(option)}
              style={{
                padding: '18px 12px',
                fontSize: '18px',
                fontWeight: 600,
                border: currentAnswer === option ? '4px solid #667eea' : '2px solid #ddd',
                borderRadius: '12px',
                background: currentAnswer === option ? '#f0f4ff' : 'white',
                color: '#333',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'center',
                boxShadow: currentAnswer === option ? '0 4px 12px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'normal',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto'
              }}
              onMouseEnter={(e) => {
                if (currentAnswer !== option) {
                  e.target.style.background = '#f9f9f9';
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentAnswer !== option) {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#ddd';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              <span>{currentAnswer === option && '✓ '}{option}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: Static Navigation Buttons */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        gap: '12px',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '15px',
        padding: '1.5rem',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={handlePrev}
          disabled={currentPage === 0}
          style={{
            flex: 1,
            padding: '16px 12px',
            fontSize: '18px',
            fontWeight: 600,
            border: 'none',
            borderRadius: '12px',
            background: currentPage === 0 ? '#ccc' : '#764ba2',
            color: 'white',
            cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
            transition: 'transform 0.2s',
            opacity: currentPage === 0 ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (currentPage > 0) {
              e.target.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
          }}
        >
          ← Back
        </button>

        <button
          onClick={handleNext}
          disabled={!currentAnswer}
          style={{
            flex: 1,
            padding: '16px 12px',
            fontSize: '18px',
            fontWeight: 600,
            border: 'none',
            borderRadius: '12px',
            background: !currentAnswer ? '#ccc' : '#667eea',
            color: 'white',
            cursor: !currentAnswer ? 'not-allowed' : 'pointer',
            transition: 'transform 0.2s',
            opacity: !currentAnswer ? 0.5 : 1
          }}
          onMouseEnter={(e) => {
            if (currentAnswer) {
              e.target.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
          }}
        >
          {currentPage === fields.length - 1 ? 'See Story!' : 'Next'} →
        </button>
      </div>
    </div>
  );
}

export default App;
