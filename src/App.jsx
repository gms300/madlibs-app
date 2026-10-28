import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import stories from './data';
import typeOptions from './data/TypeOptions.json';
import Administration from './Administration';
import { applyModifiers, findCaseInsensitiveKey, parsePlaceholder } from './storyModifiers.mjs';

const MAX_FIELD_OPTIONS = 10;

export function getRandomOptions(options) {
  const shuffled = [...options];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, MAX_FIELD_OPTIONS);
}

export function renderStory(template, answers) {
  return template.replace(/\{([^{}]+)\}/g, (placeholder, content) => {
    const parsed = parsePlaceholder(content);
    if (!parsed) return placeholder;
    const { key, attribute, modifierNames } = parsed;
    const answerKey = findCaseInsensitiveKey(answers, key);
    if (answerKey === undefined) return placeholder;
    const answer = answers[answerKey];
    let value;
    if (attribute) {
      if (!answer?.attributes) return placeholder;
      const attributeKey = findCaseInsensitiveKey(answer.attributes, attribute);
      if (attributeKey === undefined) return placeholder;
      value = answer.attributes[attributeKey];
    } else {
      value = answer.value;
    }
    const modifiedValue = applyModifiers(value, modifierNames);
    return modifiedValue === null ? placeholder : modifiedValue;
  });
}

function App() {
  const [catalog, setCatalog] = useState(() => ({ stories, types: typeOptions }));
  const [administration, setAdministration] = useState(false);
  const advanceTimeout = useRef(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [showStorySelection, setShowStorySelection] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [showStory, setShowStory] = useState(false);
  const [words, setWords] = useState({});
  const [fieldOptions, setFieldOptions] = useState({});

  useEffect(() => () => clearTimeout(advanceTimeout.current), []);

  const selectStory = (story) => {
    setSelectedStory(story);
    setFieldOptions(Object.fromEntries(story.fields.map(field => [
      field.key,
      getRandomOptions(catalog.types[field.type])
    ])));
    setShowStorySelection(false);
    setWords({});
    setCurrentPage(0);
    setShowStory(false);
  };

  const fields = selectedStory?.fields || [];

  const story = selectedStory ? renderStory(selectedStory.template, words) : '';

  const handleSelectAnswer = (answer) => {
    setWords(prev => ({ ...prev, [fields[currentPage].key]: answer }));
    clearTimeout(advanceTimeout.current);
    advanceTimeout.current = setTimeout(() => {
      if (currentPage < fields.length - 1) {
        setCurrentPage(currentPage + 1);
      } else {
        setShowStory(true);
      }
    }, 500);
  };

  const handlePrev = () => {
    clearTimeout(advanceTimeout.current);
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  if (administration) {
    return <Administration catalog={catalog} onClose={() => setAdministration(false)} onSave={async (next, change, passcode) => {
      const response = await fetch(`/api/admin/${change.kind === 'type' ? 'types' : 'stories'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
        body: JSON.stringify(change.kind === 'type'
          ? { name: change.key, options: next.types[change.key] }
          : { story: next.stories.find(item => item.id === change.key) })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? 'JSON file saving requires the local development server. Run npm start and try again.');
      }
      setCatalog(next);
    }} />;
  }

  if (showStorySelection) {
    return (
      <div style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        paddingTop: '3.5rem',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <a className="administration-link" href="#administration" onClick={event => {
          event.preventDefault();
          setAdministration(true);
        }}>Administration</a>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: 'clamp(1rem, 5vw, 2rem)',
          maxWidth: '900px',
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
          }}>Let's make a story!</h1>

          <p style={{
            fontSize: '18px',
            color: '#666',
            marginTop: 0,
            marginBottom: '2rem'
          }}>
            Pick a story to get started!
          </p>

          <div className="story-selection-grid">
            {catalog.stories.map(s => (
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
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#ddd';
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
        minHeight: '100dvh',
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
          padding: 'clamp(1rem, 5vw, 2rem)',
          maxWidth: '900px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: 'clamp(28px, 4.5vh, 36px)',
            fontWeight: 700,
            marginTop: 0,
            marginBottom: '0.75rem',
            color: '#333'
          }}>{selectedStory.title}</h1>

          <p style={{
            fontSize: 'clamp(18px, 3vh, 24px)',
            lineHeight: '1.45',
            color: '#333',
            marginBottom: '2rem',
            whiteSpace: 'pre-line',
            fontFamily: 'Georgia, serif'
          }}>
            {story}
          </p>

          <button
            onClick={() => {
              setShowStorySelection(true);
              setSelectedStory(null);
            }}
            style={{
              width: '100%',
              padding: 'clamp(10px, 2vh, 20px) 12px',
              backgroundColor: '#764ba2',
              border: 'none',
              borderRadius: '15px',
              fontSize: 'clamp(18px, 3vh, 24px)',
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
            Start Over
          </button>
        </div>
      </div>
    );
  }

  const field = fields[currentPage];
  const currentAnswer = words[field.key];

  return (
    <div style={{
      height: '100dvh',
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
          {renderStory(field.prompt, words)}
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
          {fieldOptions[field.key].map(option => (
            <button
              key={option.value}
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
              <span>{currentAnswer === option && '✓ '}{option.value}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom: Back navigation */}
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

      </div>
    </div>
  );
}

export default App;
