import React, { useEffect, useState, useMemo } from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

// Register chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const PAGE_SIZE = 6;

const SessionModal = ({
  show,
  onClose,
  exePath,
  singleSession,
  allSessions,
  onDeleteSession,
  onClearAllSessions,
  showToastMessage,
}) => {
  const [tab, setTab] = useState(singleSession ? "single" : "all");

  // For infinite loading
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  // Toggle for daily/weekly/monthly
  const [barRange, setBarRange] = useState("weekly");

  // Clear all confirmation
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // When sessions change, reset displayCount
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [allSessions]);

  // -----------------------------
  // 1) Sort sessions (newest first)
  // -----------------------------
  const sortedSessions = useMemo(() => {
    if (!allSessions) return [];
    return [...allSessions].sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );
  }, [allSessions]);

  // -----------------------------
  // 2) Visible slice for "Load More" button
  // -----------------------------
  const visibleSessions = useMemo(() => {
    return sortedSessions.slice(0, displayCount);
  }, [sortedSessions, displayCount]);

  // -----------------------------
  // 3) Sum total minutes -> total hours
  //    (floor of totalMinutes / 60)
  // -----------------------------
  const totalMinutes = useMemo(() => {
    return sortedSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [sortedSessions]);

  const totalHours = Math.floor(totalMinutes / 60);

  // -----------------------------
  // 4) Build the needed aggregators
  // -----------------------------
  const { hourOfDayMap, dayOfWeekMap, monthlyWeekMap, realmMap } =
    useMemo(() => {
      const hourMap = new Array(24).fill(0);

      const now = new Date();
      const todayY = now.getFullYear();
      const todayM = now.getMonth();
      const todayD = now.getDate();

      const dWeek = new Array(7).fill(0);

      const monthAgg = new Map();
      const realmAgg = new Map();

      if (allSessions) {
        allSessions.forEach((session) => {
          const start = new Date(session.startTime);
          const minutes = session.durationMinutes || 0;
          const realmName = session.realmlist || "";

          // Daily aggregator if "today"
          if (
            start.getFullYear() === todayY &&
            start.getMonth() === todayM &&
            start.getDate() === todayD
          ) {
            const hour = start.getHours();
            hourMap[hour] += minutes;
          }

          // Weekly aggregator
          const wDay = start.getDay(); // 0=Sunday..6=Saturday
          dWeek[wDay] += minutes;

          // Monthly aggregator => "Week1..n"
          const dayOfMonth = start.getDate();
          const whichWeek = Math.floor((dayOfMonth - 1) / 7) + 1;
          const yyyy = start.getFullYear();
          const mm = String(start.getMonth() + 1).padStart(2, "0");
          const monthKey = `${yyyy}-${mm}-Week${whichWeek}`;
          monthAgg.set(monthKey, (monthAgg.get(monthKey) || 0) + minutes);

          // Realm aggregator
          if (realmName) {
            realmAgg.set(realmName, (realmAgg.get(realmName) || 0) + minutes);
          }
        });
      }

      return {
        hourOfDayMap: hourMap,
        dayOfWeekMap: dWeek,
        monthlyWeekMap: monthAgg,
        realmMap: realmAgg,
      };
    }, [allSessions]);

  // If singleSession changes, set tab
  useEffect(() => {
    if (singleSession) setTab("single");
    else setTab("all");
  }, [singleSession, allSessions]);

  // Date/time format helpers
  const formatSessionDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  };
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // =============== CHART LOGIC ===============
  // daily => line chart with hourOfDayMap
  const buildDailyLineData = () => {
    const labels = [...Array(24).keys()].map((h) => `${h}:00`);
    const data = hourOfDayMap;
    return {
      labels,
      datasets: [
        {
          label: "Today's Playtime (min)",
          data,
          borderColor: "#4371e0",
          backgroundColor: "#4371e0",
        },
      ],
    };
  };

  // weekly => bar chart with dayOfWeekMap
  const buildWeeklyBarData = () => {
    const dayLabels = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return {
      labels: dayLabels,
      datasets: [
        {
          label: "Weekly Time (min)",
          data: dayOfWeekMap,
          backgroundColor: "#4371e0",
        },
      ],
    };
  };

  // monthly => line chart with monthlyWeekMap
  const buildMonthlyLineData = () => {
    const keys = [...monthlyWeekMap.keys()].sort();
    const values = keys.map((k) => monthlyWeekMap.get(k));
    return {
      labels: keys,
      datasets: [
        {
          label: "Monthly Time (min)",
          data: values,
          borderColor: "#4371e0",
          backgroundColor: "#4371e0",
        },
      ],
    };
  };

  // realm distribution => pie
  const buildRealmPieData = () => {
    const realms = [...realmMap.keys()];
    const vals = realms.map((r) => realmMap.get(r));
    return {
      labels: realms,
      datasets: [
        {
          label: "Realm Distribution",
          data: vals,
          backgroundColor: [
            "#0d6efd",
            "#6f42c1",
            "#d63384",
            "#fd7e14",
            "#ffc107",
            "#198754",
            "#20c997",
            "#0dcaf0",
          ],
          borderColor: "transparent",
        },
      ],
    };
  };

  const realmPieData = buildRealmPieData();
  let mainChartType = "line";
  let mainChartData = buildMonthlyLineData();
  let mainChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Total Time (min)" },
      },
    },
  };

  if (barRange === "daily") {
    mainChartType = "line";
    mainChartData = buildDailyLineData();
    mainChartOptions.scales.y.title.text = "Today's Time (min)";
  } else if (barRange === "weekly") {
    mainChartType = "bar";
    mainChartData = buildWeeklyBarData();
    mainChartOptions.scales.y.title.text = "Weekly Time (min)";
  } else if (barRange === "monthly") {
    mainChartType = "line";
    mainChartData = buildMonthlyLineData();
    mainChartOptions.scales.y.title.text = "Monthly Time (min)";
  }

  const renderMainChart = () => {
    if (barRange === "daily") {
      const totalDaily = hourOfDayMap.reduce((sum, val) => sum + val, 0);
      if (totalDaily === 0) {
        return <p>No data available for today</p>;
      }
    }
    if (mainChartType === "line") {
      return <Line data={mainChartData} options={mainChartOptions} />;
    }
    return <Bar data={mainChartData} options={mainChartOptions} />;
  };

  // “Load More”
  const handleLoadMore = () => {
    setDisplayCount((prev) => prev + PAGE_SIZE);
  };

  // Local function to handle single session deletion,
  // ensuring we pass the correct index to `onDeleteSession`.
  const handleDeleteSession = (session) => {
    const idxInAll = sortedSessions.indexOf(session);
    if (idxInAll === -1) return;
    onDeleteSession(idxInAll);
    // Show a toast if the prop exists
    if (showToastMessage) {
      showToastMessage("Session deleted!", "success");
    }
  };

  // handleOpenConfirmClearAll => show the Clear All confirmation UI
  const handleOpenConfirmClearAll = () => {
    setConfirmClearAll(true);
  };

  // handleCancelClearAll => hide the Clear All confirmation UI
  const handleCancelClearAll = () => {
    setConfirmClearAll(false);
  };

  // handleConfirmClearAll => call onClearAllSessions + show toast
  const handleConfirmClearAll = () => {
    setConfirmClearAll(false);
    onClearAllSessions();
    if (showToastMessage) {
      showToastMessage("All sessions cleared!", "success");
    }
  };

  return (
    <>
      {show && <div className="modal-overlay"></div>}
      <div
        className={`modal fade ${show ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        style={{ display: show ? "block" : "none" }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl modal-dark modal-sessions">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {tab === "single"
                  ? "Game Session Summary"
                  : "All Game Sessions"}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
              />
            </div>

            <div className="modal-body">
              {tab === "single" && singleSession ? (
                // SINGLE SESSION VIEW
                <div>
                  <p>
                    We hope you had a great time playing! Here is a quick
                    preview of your session.
                  </p>
                  <div className="card flex-fill h-100">
                    <div className="card-body d-flex flex-column">
                      <h5 className="card-title d-flex justify-content-between mb-0">
                        <span>
                          {formatSessionDate(singleSession.startTime)}
                        </span>
                      </h5>
                      {singleSession.realmlist && (
                        <small className="text-muted fw-medium">
                          {singleSession.realmlist}
                        </small>
                      )}
                      <p className="mt-3 mb-1">
                        You have been playing for{" "}
                        <span className="fw-medium text-primary">
                          {singleSession.durationMinutes}
                        </span>{" "}
                        minutes.
                      </p>
                      <Tippy
                        content="Start time - End time"
                        placement="auto"
                        className="custom-tooltip"
                      >
                        <small className="text-muted">
                          ({formatTime(singleSession.startTime)} -{" "}
                          {formatTime(singleSession.endTime)})
                        </small>
                      </Tippy>
                    </div>
                  </div>
                </div>
              ) : (
                // ALL SESSIONS VIEW
                <div>
                  {(!visibleSessions || visibleSessions.length === 0) && (
                    <>
                      <h3 className="text-danger">No sessions found!</h3>
                      <p className="text-muted fw-medium">
                        Warperia will begin tracking your sessions whenever you
                        launch your game.
                      </p>
                      <p className="text-muted fw-medium">
                        Some additional information:
                      </p>
                      <ul className="text-muted fw-medium">
                        <li>
                          Only sessions that are bigger than 5 minutes will be
                          counted.
                        </li>
                        <li>
                          Active sessions will stop whenever you close your
                          game. Clicking the{" "}
                          <span className="btn btn-sm btn-secondary-2">
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Restart
                          </span>{" "}
                          button won't cancel your currently active session.
                        </li>
                        <li>
                          Sessions are saved locally in your game directory.
                        </li>
                        <li>
                          Sessions are not uploaded to Warperia. They are
                          private and only you have access to them.
                        </li>
                      </ul>
                    </>
                  )}

                  {visibleSessions && visibleSessions.length > 0 && (
                    <>
                      <div className="mb-4">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="left">
                            <h5 className="fw-medium">Your Playtime Overview</h5>
                            <p className="text-muted fw-medium">
                              Take a look at the total amount of hours spent
                              in-game
                            </p>
                          </div>
                          <div className="right text-center">
                            <p className="text-muted fw-medium mb-0">
                              Total Playtime
                            </p>
                            <h3>{totalHours} hours</h3>
                          </div>
                        </div>

                        <div className="d-flex gap-2 mb-2">
                          <button
                            className={`btn btn-sm ${
                              barRange === "daily"
                                ? "btn-primary"
                                : "btn-secondary-2"
                            }`}
                            onClick={() => setBarRange("daily")}
                          >
                            Daily
                          </button>
                          <button
                            className={`btn btn-sm ${
                              barRange === "weekly"
                                ? "btn-primary"
                                : "btn-secondary-2"
                            }`}
                            onClick={() => setBarRange("weekly")}
                          >
                            Weekly
                          </button>
                          <button
                            className={`btn btn-sm ${
                              barRange === "monthly"
                                ? "btn-primary"
                                : "btn-secondary-2"
                            }`}
                            onClick={() => setBarRange("monthly")}
                          >
                            Monthly
                          </button>
                        </div>

                        <div className="row mb-4">
                          <div className="col-md-6">
                            <div
                              className="chart-container card p-2 mb-3"
                              style={{ height: "300px" }}
                            >
                              <h6 className="mb-1 fw-medium text-center">
                                {barRange.charAt(0).toUpperCase() +
                                  barRange.slice(1)}{" "}
                                Playtime
                              </h6>
                              <div
                                style={{ position: "relative", height: "100%" }}
                              >
                                {renderMainChart()}
                              </div>
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div
                              className="chart-container card p-2 mb-3"
                              style={{ height: "300px" }}
                            >
                              <h6 className="mb-1 fw-medium text-center">
                                Servers
                              </h6>
                              <div
                                style={{ position: "relative", height: "100%" }}
                              >
                                <Pie
                                  data={buildRealmPieData()}
                                  options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                      legend: { position: "bottom" },
                                    },
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <h5 className="fw-medium">Game Sessions</h5>
                      <p className="text-muted fw-medium">
                        A list of your previous gaming sessions
                      </p>
                      {/* The sessions list (cards) */}
                      <div className="row row-cols-1 row-cols-md-2 g-3">
                        {visibleSessions.map((session, index) => {
                          const formattedDate = formatSessionDate(
                            session.startTime
                          );
                          const sessionStart = formatTime(session.startTime);
                          const sessionEnd = formatTime(session.endTime);

                          return (
                            <div key={index} className="col d-flex">
                              <div className="card flex-fill h-100">
                                <div className="card-body d-flex flex-column">
                                  <h5 className="card-title d-flex justify-content-between mb-0">
                                    <span>{formattedDate}</span>
                                    <Tippy
                                      content="Delete this session"
                                      placement="top"
                                      className="custom-tooltip"
                                    >
                                      <button
                                        className="btn btn-sm btn-secondary"
                                        // FIX #2: call local "handleDeleteSession"
                                        onClick={() =>
                                          handleDeleteSession(session)
                                        }
                                      >
                                        <i className="bi bi-trash2-fill"></i>
                                      </button>
                                    </Tippy>
                                  </h5>
                                  {session.realmlist && (
                                    <small className="text-muted fw-medium">
                                      {session.realmlist}
                                    </small>
                                  )}
                                  <h2 className="mt-3 mb-1">
                                    {session.durationMinutes} min
                                  </h2>
                                  <small className="text-muted">
                                    ({sessionStart} - {sessionEnd})
                                  </small>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* "Load More" */}
                      {displayCount < sortedSessions.length && (
                        <div className="text-center mt-3">
                          <button
                            className="btn btn-secondary-2"
                            onClick={() =>
                              setDisplayCount((prev) => prev + PAGE_SIZE)
                            }
                          >
                            Load More
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer justify-content-between">
              {tab === "all" && allSessions && allSessions.length > 0 && (
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-danger me-auto"
                    onClick={handleOpenConfirmClearAll}
                  >
                    <i className="bi bi-trash"></i> Clear All
                  </button>
                  {confirmClearAll && (
                    <div className="confirm-overlay d-flex align-items-center">
                      <span className="text-muted fw-medium me-2">Are you sure?</span>
                      <div className="d-flex justify-content-end gap-2">
                        <button
                          className="btn btn-secondary"
                          onClick={handleCancelClearAll}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={handleConfirmClearAll}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                <i className="bi bi-x-lg"></i> Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SessionModal;
