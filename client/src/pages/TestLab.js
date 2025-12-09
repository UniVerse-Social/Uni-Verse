import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

/* =============== Layout & Theme =============== */

const Shell = styled.div`
  position: fixed;
  top: var(--nav-height, 64px);
  right: 0;
  bottom: 0;
  left: 0;

  display: grid;
  grid-template-columns: 240px 1fr;
  background: #0b0f1a;
  color: #e8ecff;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  @media (max-width: 768px) {
    bottom: calc(var(--mobile-nav-height, 64px) + env(safe-area-inset-bottom));
  }
`;

const Sidebar = styled.aside`
  background: rgba(25, 30, 48, 0.9);
  border-right: 1px solid rgba(100, 100, 150, 0.25);
  padding: 22px 16px;
  backdrop-filter: blur(6px);

  @media (max-width: 900px) {
    display: none;
  }
`;

const SideTitle = styled.div`
  font-weight: 900;
  font-size: 22px;
  margin-bottom: 18px;
  background: linear-gradient(90deg, #9ab6ff, #c8afff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const SideNav = styled.nav`
  display: grid;
  gap: 10px;
`;

const SideLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  text-decoration: none;
  color: #d9e1ff;
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 700;
  transition: 0.15s ease;

  &:hover {
    background: rgba(140, 130, 255, 0.18);
    color: #ffffff;
  }
`;

const Main = styled.main`
  overflow-y: auto;
  padding: clamp(18px, 2.4vw, 32px);
`;

const H1 = styled.h1`
  margin: 0 0 6px;
  font-weight: 900;
  font-size: clamp(30px, 4.5vw, 48px);
  background: linear-gradient(90deg, #8ea8ff, #a879ff, #59d0ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const Sub = styled.p`
  margin: 4px 0 22px;
  color: #9af0ff;
  opacity: 0.8;
`;

/* =============== Shared UI Bits =============== */

const Tabs = styled.div`
  display: inline-flex;
  gap: 8px;
  background: rgba(24, 28, 48, 0.9);
  padding: 6px;
  border-radius: 12px;
  border: 1px solid rgba(110, 120, 190, 0.5);
  margin-bottom: 16px;
`;

const TabBtn = styled.button`
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-weight: 900;
  cursor: pointer;
  background: ${p =>
    p.active ? 'rgba(120, 120, 255, 0.35)' : 'transparent'};
  color: #e8ecff;
  transition: 0.15s ease;

  &:hover {
    background: rgba(110, 120, 220, 0.4);
  }
`;

const Card = styled.section`
  background: rgba(20, 24, 40, 0.96);
  border: 1px solid rgba(120, 120, 170, 0.3);
  border-radius: 18px;
  padding: clamp(18px, 2.2vw, 24px);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  margin-bottom: 18px;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: repeat(${p => p.cols || 2}, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div`
  display: grid;
  gap: 6px;
`;

const Label = styled.label`
  font-weight: 800;
  color: #cfd8ff;
`;

const Input = styled.input`
  height: 40px;
  border: 1px solid rgba(150, 150, 200, 0.4);
  border-radius: 10px;
  padding: 0 10px;
  font-weight: 600;
  background: rgba(25, 28, 45, 0.9);
  color: #e8ecff;
`;

const Select = styled.select`
  height: 40px;
  border: 1px solid rgba(150, 150, 200, 0.4);
  border-radius: 10px;
  padding: 0 10px;
  font-weight: 600;
  background: rgba(25, 28, 45, 0.9);
  color: #e8ecff;
`;

const SmallButton = styled.button`
  height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(140, 140, 200, 0.45);
  background: rgba(35, 40, 70, 0.95);
  font-weight: 800;
  cursor: pointer;
  color: #dbe5ff;
  transition: 0.15s ease;

  &:hover {
    background: rgba(55, 65, 100, 0.98);
  }
`;

const Tag = styled.span`
  display: inline-flex;
  height: 22px;
  align-items: center;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 900;
  border-radius: 999px;
  color: #a9bcff;
  background: rgba(95, 115, 255, 0.25);
  border: 1px solid rgba(145, 165, 255, 0.45);
`;

const Small = styled.small`
  color: #9bb5ff;
  opacity: 0.8;
`;

/* =============== Quick Final Calculator =============== */

function QuickFinalCard() {
  const [current, setCurrent] = useState('');
  const [finalWeight, setFinalWeight] = useState('');
  const [target, setTarget] = useState('');

  const needed = useMemo(() => {
    const c = parseFloat(current);
    const w = parseFloat(finalWeight);
    const t = parseFloat(target);
    if (Number.isNaN(c) || Number.isNaN(w) || Number.isNaN(t) || w <= 0 || w >= 100) {
      return null;
    }
    // Target% = c*(1 - w/100) + x*(w/100)
    const portion = w / 100;
    const x = (t - c * (1 - portion)) / portion;
    return x;
  }, [current, finalWeight, target]);

  return (
    <Card>
      <h2 style={{ marginTop: 0, marginBottom: 10 }}>Quick Final Calculator</h2>
      <Row cols={3}>
        <Field>
          <Label>Current grade in class (%)</Label>
          <Input
            type="number"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            placeholder="e.g. 87"
          />
        </Field>
        <Field>
          <Label>Final exam weight (%)</Label>
          <Input
            type="number"
            value={finalWeight}
            onChange={e => setFinalWeight(e.target.value)}
            placeholder="e.g. 35"
          />
        </Field>
        <Field>
          <Label>Desired final grade (%)</Label>
          <Input
            type="number"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="e.g. 90"
          />
        </Field>
      </Row>

      <div style={{ marginTop: 16 }}>
        {needed == null ? (
          <Small>Enter all three numbers to see what you need on the final.</Small>
        ) : (
          <>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              You need about{' '}
              <span style={{ color: '#ffd26a' }}>
                {needed.toFixed(2)}%
              </span>{' '}
              on your final exam.
            </div>
            {needed > 100 && (
              <Small>
                This is above 100%. It may be mathematically impossible to end with your
                desired grade in this class.
              </Small>
            )}
            {needed < 0 && (
              <Small>
                You could score 0 on the final and still reach your desired grade. 💅
              </Small>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

/* =============== Helpers for Class Planner =============== */

function createEmptyCourse() {
  return {
    id: `course_${Date.now()}`,
    name: 'My Class',
    target: 90,
    sections: [
      { id: 'sec_quiz', label: 'Quizzes', weight: 15, isFinal: false, assignments: [] },
      { id: 'sec_mid', label: 'Midterm', weight: 25, isFinal: false, assignments: [] },
      { id: 'sec_hw', label: 'Homework', weight: 20, isFinal: false, assignments: [] },
      { id: 'sec_final', label: 'Final Exam', weight: 40, isFinal: true, assignments: [] }
    ]
  };
}

function computeSectionAverage(section) {
  const totalEarned = section.assignments.reduce(
    (sum, a) => sum + (Number(a.score) || 0),
    0
  );
  const totalPossible = section.assignments.reduce(
    (sum, a) => sum + (Number(a.outOf) || 0),
    0
  );
  if (!totalPossible) return null;
  return (totalEarned / totalPossible) * 100;
}

function computeCurrentGrade(course) {
  const sections = course.sections || [];
  let weightedSum = 0;
  let weightUsed = 0;

  sections.forEach(sec => {
    const avg = computeSectionAverage(sec);
    if (avg != null) {
      weightedSum += avg * (Number(sec.weight) || 0);
      weightUsed += Number(sec.weight) || 0;
    }
  });

  if (!weightUsed) return null;
  return weightedSum / weightUsed;
}

function computeNeededOnFinal(course) {
  const target = Number(course.target);
  if (Number.isNaN(target)) return null;

  const totalWeight = course.sections.reduce(
    (sum, sec) => sum + (Number(sec.weight) || 0),
    0
  );

  const finalSection = course.sections.find(sec => sec.isFinal);
  if (!finalSection) return null;

  const wFinal = Number(finalSection.weight) || 0;
  if (!wFinal) return null;

  // require weights to add up reasonably close to 100 for this calc
  if (Math.abs(totalWeight - 100) > 0.5) return { invalidWeights: true };

  let sumNonFinal = 0;
  course.sections.forEach(sec => {
    if (sec.id === finalSection.id) return;
    const avg = computeSectionAverage(sec);
    if (avg != null) {
      sumNonFinal += avg * (Number(sec.weight) || 0);
    }
  });

  // target% * 100 = sumNonFinal + wFinal * x
  const x = (target * 100 - sumNonFinal) / wFinal;
  return { needed: x, invalidWeights: false };
}

/* =============== Class Planner UI =============== */

function PlannerCard() {
  const [courses, setCourses] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  // load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('testlab_courses');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setCourses(parsed);
          setSelectedId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load TestLab courses', e);
    }
    const def = createEmptyCourse();
    setCourses([def]);
    setSelectedId(def.id);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem('testlab_courses', JSON.stringify(courses));
    } catch (e) {
      console.warn('Failed to save TestLab courses', e);
    }
  }, [courses]);

  const selectedCourse = courses.find(c => c.id === selectedId);

  const updateCourse = updater => {
    setCourses(prev =>
      prev.map(c => (c.id === selectedId ? updater(c) : c))
    );
  };

  const addCourse = () => {
    const next = createEmptyCourse();
    setCourses(prev => [next, ...prev]);
    setSelectedId(next.id);
  };

  const deleteCourse = () => {
    if (!selectedCourse) return;
    const remaining = courses.filter(c => c.id !== selectedCourse.id);
    setCourses(remaining);
    if (remaining.length) {
      setSelectedId(remaining[0].id);
    } else {
      const def = createEmptyCourse();
      setCourses([def]);
      setSelectedId(def.id);
    }
  };

  const currentGrade = selectedCourse ? computeCurrentGrade(selectedCourse) : null;
  const neededFinal = selectedCourse ? computeNeededOnFinal(selectedCourse) : null;

  if (!selectedCourse) return null;

  return (
    <>
      <Card>
        <Row cols={3}>
          <Field>
            <Label>Saved class</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Select
                style={{ flex: 1 }}
                value={selectedCourse.id}
                onChange={e => setSelectedId(e.target.value)}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <SmallButton type="button" onClick={addCourse}>
                + New
              </SmallButton>
            </div>
          </Field>
          <Field>
            <Label>Class name</Label>
            <Input
              value={selectedCourse.name}
              onChange={e =>
                updateCourse(c => ({ ...c, name: e.target.value }))
              }
            />
          </Field>
          <Field>
            <Label>Target overall grade (%)</Label>
            <Input
              type="number"
              value={selectedCourse.target}
              onChange={e =>
                updateCourse(c => ({
                  ...c,
                  target: e.target.value === '' ? '' : Number(e.target.value)
                }))
              }
            />
          </Field>
        </Row>
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            {currentGrade != null ? (
              <div style={{ fontWeight: 900 }}>
                Current grade (based on completed work):{' '}
                <span style={{ color: '#a9ffdd' }}>
                  {currentGrade.toFixed(2)}%
                </span>
              </div>
            ) : (
              <Small>
                Add assignments to at least one section to see your current grade.
              </Small>
            )}
            <Small>
              Empty sections are ignored in the current grade. Only categories with
              assignments are counted.
            </Small>
          </div>
          <div>
            <SmallButton type="button" onClick={deleteCourse}>
              Delete class
            </SmallButton>
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Class grade structure</h2>
        <Small>
          Set up your syllabus: how much are quizzes, exams, homework, and the final
          worth? Mark one section as your Final.
        </Small>
        <div
          style={{
            marginTop: 12,
            display: 'grid',
            gap: 10
          }}
        >
          {selectedCourse.sections.map(sec => (
            <Row key={sec.id} cols={4}>
              <Field>
                <Label>Section name</Label>
                <Input
                  value={sec.label}
                  onChange={e =>
                    updateCourse(c => ({
                      ...c,
                      sections: c.sections.map(s =>
                        s.id === sec.id ? { ...s, label: e.target.value } : s
                      )
                    }))
                  }
                />
              </Field>
              <Field>
                <Label>Weight (%)</Label>
                <Input
                  type="number"
                  value={sec.weight}
                  onChange={e =>
                    updateCourse(c => ({
                      ...c,
                      sections: c.sections.map(s =>
                        s.id === sec.id
                          ? {
                              ...s,
                              weight:
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                            }
                          : s
                      )
                    }))
                  }
                />
              </Field>
              <Field>
                <Label>Average</Label>
                <div>
                  {(() => {
                    const avg = computeSectionAverage(sec);
                    return avg == null ? (
                      <Small>No assignments yet</Small>
                    ) : (
                      <span style={{ fontWeight: 900 }}>
                        {avg.toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
              </Field>
              <Field>
                <Label>Final?</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    checked={!!sec.isFinal}
                    onChange={() =>
                      updateCourse(c => ({
                        ...c,
                        sections: c.sections.map(s => ({
                          ...s,
                          isFinal: s.id === sec.id
                        }))
                      }))
                    }
                  />
                  <Small>Mark this as the final exam category</Small>
                </div>
              </Field>
            </Row>
          ))}
        </div>
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <Small>
              Total weight:{' '}
              {selectedCourse.sections
                .reduce((sum, s) => sum + (Number(s.weight) || 0), 0)
                .toFixed(2)}
              %
            </Small>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <SmallButton
              type="button"
              onClick={() =>
                updateCourse(c => ({
                  ...c,
                  sections: [
                    ...c.sections,
                    {
                      id: `sec_${Date.now()}`,
                      label: 'New Section',
                      weight: 0,
                      isFinal: false,
                      assignments: []
                    }
                  ]
                }))
              }
            >
              + Add section
            </SmallButton>
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>Assignments & scores</h2>
        <Small>
          Click into a section and log your quizzes, tests, projects, etc. You can also
          add "what if" scores to see how they change your grade.
        </Small>

        {selectedCourse.sections.map(sec => (
          <div
            key={sec.id}
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid rgba(140,140,200,0.4)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'center',
                marginBottom: 8
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {sec.label}{' '}
                <Tag>
                  {sec.weight || 0}%{sec.isFinal ? ' • Final' : ''}
                </Tag>
              </div>
              <SmallButton
                type="button"
                onClick={() =>
                  updateCourse(c => ({
                    ...c,
                    sections: c.sections.map(s =>
                      s.id === sec.id
                        ? {
                            ...s,
                            assignments: [
                              ...s.assignments,
                              {
                                id: `a_${Date.now()}`,
                                label: `Assignment ${s.assignments.length + 1}`,
                                score: '',
                                outOf: ''
                              }
                            ]
                          }
                        : s
                    )
                  }))
                }
              >
                + Add assignment
              </SmallButton>
            </div>

            {sec.assignments.length === 0 ? (
              <Small>No assignments logged yet.</Small>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {sec.assignments.map(a => (
                  <Row key={a.id} cols={4}>
                    <Field>
                      <Label>Label</Label>
                      <Input
                        value={a.label}
                        onChange={e =>
                          updateCourse(c => ({
                            ...c,
                            sections: c.sections.map(s =>
                              s.id === sec.id
                                ? {
                                    ...s,
                                    assignments: s.assignments.map(x =>
                                      x.id === a.id
                                        ? { ...x, label: e.target.value }
                                        : x
                                    )
                                  }
                                : s
                            )
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label>Score</Label>
                      <Input
                        type="number"
                        value={a.score}
                        onChange={e =>
                          updateCourse(c => ({
                            ...c,
                            sections: c.sections.map(s =>
                              s.id === sec.id
                                ? {
                                    ...s,
                                    assignments: s.assignments.map(x =>
                                      x.id === a.id
                                        ? {
                                            ...x,
                                            score:
                                              e.target.value === ''
                                                ? ''
                                                : Number(e.target.value)
                                          }
                                        : x
                                    )
                                  }
                                : s
                            )
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label>Out of</Label>
                      <Input
                        type="number"
                        value={a.outOf}
                        onChange={e =>
                          updateCourse(c => ({
                            ...c,
                            sections: c.sections.map(s =>
                              s.id === sec.id
                                ? {
                                    ...s,
                                    assignments: s.assignments.map(x =>
                                      x.id === a.id
                                        ? {
                                            ...x,
                                            outOf:
                                              e.target.value === ''
                                                ? ''
                                                : Number(e.target.value)
                                          }
                                        : x
                                    )
                                  }
                                : s
                            )
                          }))
                        }
                      />
                    </Field>
                    <Field>
                      <Label>&nbsp;</Label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <SmallButton
                          type="button"
                          onClick={() =>
                            updateCourse(c => ({
                              ...c,
                              sections: c.sections.map(s =>
                                s.id === sec.id
                                  ? {
                                      ...s,
                                      assignments: s.assignments.filter(
                                        x => x.id !== a.id
                                      )
                                    }
                                  : s
                              )
                            }))
                          }
                        >
                          Remove
                        </SmallButton>
                      </div>
                    </Field>
                  </Row>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <h2 style={{ marginTop: 0, marginBottom: 10 }}>What do I need on the final?</h2>
        {neededFinal == null ? (
          <Small>
            Set a target grade, mark one section as Final, make sure your weights add to
            ~100%, and add scores to the other sections.
          </Small>
        ) : neededFinal.invalidWeights ? (
          <Small>
            Your section weights don&apos;t add up to 100%. Adjust them to use this
            calculator.
          </Small>
        ) : (
          <>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              To end with{' '}
              <span style={{ color: '#ffd26a' }}>
                {Number(selectedCourse.target).toFixed(1)}%
              </span>{' '}
              overall, you need about{' '}
              <span style={{ color: '#ffd26a' }}>
                {neededFinal.needed.toFixed(2)}%
              </span>{' '}
              in your Final section.
            </div>
            {neededFinal.needed > 100 && (
              <Small>
                This is above 100%. It may not be possible to reach your target grade
                with the current scores.
              </Small>
            )}
            {neededFinal.needed < 0 && (
              <Small>
                Your existing scores are strong enough that you could score 0 on the
                Final and still reach your target.
              </Small>
            )}
          </>
        )}
      </Card>
    </>
  );
}

/* =============== Page Component =============== */

export default function TestLab() {
  const [tab, setTab] = useState('quick');

  return (
    <Shell>
      <Sidebar>
        <SideTitle>TestLab</SideTitle>
        <SideNav>
          <SideLink to="/ai">🏠 AI Home</SideLink>
          <SideLink to="/ai/testlab">🧮 TestLab</SideLink>
        </SideNav>
      </Sidebar>

      <Main>
        <H1>TestLab</H1>
        <Sub>
          Figure out exactly what you need on your next quiz, midterm, or final — and
          track your whole class structure in one place.
        </Sub>

        <Tabs>
          <TabBtn
            type="button"
            active={tab === 'quick'}
            onClick={() => setTab('quick')}
          >
            Quick final calculator
          </TabBtn>
          <TabBtn
            type="button"
            active={tab === 'planner'}
            onClick={() => setTab('planner')}
          >
            Full class planner
          </TabBtn>
        </Tabs>

        {tab === 'quick' ? (
          <>
            <QuickFinalCard />
            <Card>
              <Small>
                Want full control? Switch to the{' '}
                <span style={{ fontWeight: 800 }}>Full class planner</span> tab to build
                a syllabus-style grade breakdown (quizzes, midterms, homework, final)
                and log each score (13/15, 42/50, etc.).
              </Small>
            </Card>
          </>
        ) : (
          <PlannerCard />
        )}
      </Main>
    </Shell>
  );
}
