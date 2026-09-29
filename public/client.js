/* ============================================================
   GEETA'S CLINIC - DIGITAL TOKEN SYSTEM
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {

    /* ============================================================
       PAGE ELEMENTS
       ============================================================ */

    const welcomePage = document.getElementById("welcomePage");
    const loginPage = document.getElementById("loginPage");
    const tokenPage = document.getElementById("tokenPage");

    const getStartedBtn = document.getElementById("getStartedBtn");
    const loginForm = document.getElementById("loginForm");

    /* ============================================================
       DATA
       ============================================================ */

    const doctors = [
        {
            id: "doctor1",
            name: "Dr. Sarah Jenkins",
            initials: "SJ",
            accent: "cyan",
            department: "General Medicine",
            room: "Consulting Room 1",
            roomShort: "Room 1",
            prefix: "A",
            currentToken: "A-102",
            currentPatient: "Emma Watson",
            consultMinutes: 16,
            nextTokens: ["A-103", "A-104", "A-105"]
        },
        {
            id: "doctor2",
            name: "Dr. Alan Miller",
            initials: "AM",
            accent: "purple",
            department: "Pediatrics & Child Care",
            room: "Consulting Room 2",
            roomShort: "Room 2",
            prefix: "B",
            currentToken: "B-101",
            currentPatient: "Liam Johnson",
            consultMinutes: 9,
            nextTokens: ["B-102"]
        },
        {
            id: "doctor3",
            name: "Dr. Priya Patel",
            initials: "PP",
            accent: "amber",
            department: "Dermatology & Skin Care",
            room: "Consulting Room 3",
            roomShort: "Room 3",
            prefix: "C",
            currentToken: "C-101",
            currentPatient: "Aria Stark",
            consultMinutes: 4,
            nextTokens: []
        }
    ];

    let selectedDoctor = doctors[0];
    let staffQueue = [];
    let staffHistory = [];
    let activeStaffView = "waiting";

    /* ============================================================
    AUTH STATE (SQLite session, verified server-side)
       ============================================================ */

    let currentUser = { authenticated: false, isStaff: false, role: null, name: null };

    async function refreshAuthStatus() {
        try {
            const res = await fetch("/api/me", { credentials: "include" });
            currentUser = await res.json();
        } catch (err) {
            currentUser = { authenticated: false, isStaff: false, role: null, name: null };
        }
        renderAuthUI();
        return currentUser;
    }

    function renderAuthUI() {
        const authArea = document.getElementById("staffAuthArea");
        if (!authArea) return;

        if (currentUser.authenticated) {
            authArea.innerHTML =
                `<span class="staff-auth-name">Signed in: ${currentUser.name || "User"}</span>` +
                `<button type="button" class="staff-auth-btn" id="logoutButton">Logout</button>`;
            document.getElementById("logoutButton").addEventListener("click", logout);
        } else {
            authArea.innerHTML =
                `<a href="#" class="staff-auth-btn" id="accountLoginButton">Login</a>`;
            document.getElementById("accountLoginButton").addEventListener("click", (event) => {
                event.preventDefault();
                showPage("loginPage");
            });
        }
    }

    // Calls a protected staff-only API endpoint and returns to account
    // login if the session is missing or expired.
    async function callStaffApi(path, body) {
        const res = await fetch(path, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body || {})
        });

        if (res.status === 401 || res.status === 403) {
            showPage("loginPage");
            return null;
        }

        if (!res.ok) {
            alert("That action could not be completed. Please try again.");
            return null;
        }

        return res.json();
    }

    let tokenNumber = localStorage.getItem("clinicToken");

    let patientName =
        localStorage.getItem("patientName") || "tanu";

    let appointmentDate =
        localStorage.getItem("appointmentDate") || "14 Dec 2026";

    let appointmentTime =
        localStorage.getItem("appointmentTime") || "09:00 AM";


    /* ============================================================
       SMALL HELPERS
       ============================================================ */

    function getInitials(name) {

        if (!name) return "?";

        return name
            .replace(/^Dr\.\s*/i, "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join("");

    }


    /* ============================================================
       PAGE NAVIGATION
       ============================================================ */

    function showPage(page) {

        const normalizedPage = String(page || "")
            .replace("Page", "")
            .toLowerCase();

        if (welcomePage) welcomePage.classList.remove("active");
        if (loginPage) loginPage.classList.remove("active");
        if (tokenPage) tokenPage.classList.remove("active");

        if (normalizedPage === "welcome" && welcomePage) {
            welcomePage.classList.add("active");
        }

        if (normalizedPage === "login" && loginPage) {
            loginPage.classList.add("active");
        }

        if (normalizedPage === "token" && tokenPage) {
            tokenPage.classList.add("active");
            showDashboard("patient");
            renderPatientView();
            renderWaitingHall();
            renderStaffDashboard();
            refreshStaffDashboardData();
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function showDashboard(view) {

        const normalizedView = String(view || "patient").toLowerCase();

        if (normalizedView === "patient" && !currentUser.authenticated) {
            showPage("loginPage");
            return;
        }

        if (tokenPage && !tokenPage.classList.contains("active")) {
            if (welcomePage) welcomePage.classList.remove("active");
            if (loginPage) loginPage.classList.remove("active");
            tokenPage.classList.add("active");
        }

        if (normalizedView === "staff" && !(currentUser.authenticated && currentUser.isStaff)) {
            showPage("loginPage");
            return;
        }

        const patientView =
            document.getElementById("patientView") ||
            document.getElementById("patientDashboard");

        const waitingHall =
            document.getElementById("waitingHall") ||
            document.getElementById("waitingDashboard");

        const staffDashboard =
            document.getElementById("staffDashboard");

        if (patientView) {
            patientView.classList.toggle("active", normalizedView === "patient");
            patientView.classList.toggle("active-dashboard", normalizedView === "patient");
        }

        if (waitingHall) {
            waitingHall.classList.toggle("active", normalizedView === "waiting");
            waitingHall.classList.toggle("active-dashboard", normalizedView === "waiting");
        }

        if (staffDashboard) {
            staffDashboard.classList.toggle("active", normalizedView === "staff");
            staffDashboard.classList.toggle("active-dashboard", normalizedView === "staff");
            if (normalizedView === "staff") refreshStaffDashboardData();
        }

        document.querySelectorAll(".tab-btn").forEach(function (button) {
            const isActive =
                (button.id === "patientViewBtn" && normalizedView === "patient") ||
                (button.id === "waitingHallBtn" && normalizedView === "waiting") ||
                (button.id === "staffDashboardBtn" && normalizedView === "staff");

            button.classList.toggle("active", isActive);
        });
    }

    function showPatientView() {
        showDashboard("patient");
    }

    function showWaitingHall() {
        showDashboard("waiting");
    }

    function showStaffDashboard() {
        showDashboard("staff");
    }

    window.showPage = showPage;
    window.showDashboard = showDashboard;
    window.showPatientView = showPatientView;
    window.showWaitingHall = showWaitingHall;
    window.showStaffDashboard = showStaffDashboard;

    document.getElementById("patientViewBtn")?.addEventListener("click", showPatientView);
    document.getElementById("waitingHallBtn")?.addEventListener("click", showWaitingHall);
    document.getElementById("staffDashboardBtn")?.addEventListener("click", showStaffDashboard);


    /* ============================================================
       GET STARTED BUTTON
       ============================================================ */

    if (getStartedBtn) {

        getStartedBtn.addEventListener("click", function () {

            showPage("login");

        });

    }


    /* ============================================================
       LOGIN
       ============================================================ */

    if (loginForm) {

        loginForm.addEventListener("submit", async function (event) {

            event.preventDefault();

            const loginError = document.getElementById("loginError");
            if (loginError) loginError.textContent = "";

            const emailInput =
                document.getElementById("loginEmail");

            const passwordInput =
                document.getElementById("loginPassword");

            let response;
            let result;

            try {
                response = await fetch("/auth/login", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: emailInput ? emailInput.value.trim() : "",
                        password: passwordInput ? passwordInput.value : ""
                    })
                });

                result = await response.json();
            } catch (error) {
                if (loginError) {
                    loginError.textContent = "Unable to sign in right now. Please try again.";
                }
                return;
            }

            if (!response.ok) {
                if (loginError) {
                    loginError.textContent = result.error || "Invalid email or password.";
                }
                return;
            }

            currentUser = {
                ...result.user,
                authenticated: true,
                isStaff: result.user.role === "staff"
            };
            patientName = result.user.name || patientName;
            localStorage.setItem("patientName", patientName);
            localStorage.setItem("patientMobile", result.user.phone || "");
            renderAuthUI();

            showPage("token");
            if (currentUser.role === "staff") {
                showDashboard("staff");
            } else {
                await loadCurrentAppointment();
            }

        });

    }

    const signupForm = document.getElementById("signupForm");
    const showSignupButton = document.getElementById("showSignupButton");

    if (showSignupButton && signupForm) {
        showSignupButton.addEventListener("click", function () {
            signupForm.style.display = "block";
            showSignupButton.style.display = "none";
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const response = await fetch("/auth/signup", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: document.getElementById("signupName").value,
                    email: document.getElementById("signupEmail").value,
                    phone: document.getElementById("signupPhone").value,
                    role: document.getElementById("signupRole").value,
                    password: document.getElementById("signupPassword").value,
                    confirmPassword: document.getElementById("signupConfirmPassword").value
                })
            });

            const result = await response.json();
            if (!response.ok) {
                alert(result.error || "Signup failed.");
                return;
            }

            alert("Account created. Please log in.");
            signupForm.reset();
            signupForm.style.display = "none";
            showSignupButton.style.display = "block";
        });
    }

    async function logout() {
        await fetch("/auth/logout", {
            method: "POST",
            credentials: "include"
        });
        currentUser = { authenticated: false, isStaff: false, role: null, name: null };
        renderAuthUI();
        showPage("welcomePage");
    }

    window.logout = logout;


    /* ============================================================
       TOKEN GENERATION
       ============================================================ */

    function applyAppointment(appointment) {
        const doctor = doctors.find(item => item.id === appointment.doctor_id);
        if (doctor) {
            selectedDoctor = doctor;
            if (!doctor.nextTokens.includes(appointment.token_number)) {
                doctor.nextTokens.push(appointment.token_number);
            }
        }

        tokenNumber = appointment.token_number;
        appointmentDate = new Date(`${appointment.appointment_date}T00:00:00`).toLocaleDateString(
            "en-IN",
            { day: "2-digit", month: "short", year: "numeric" }
        );
        appointmentTime = appointment.appointment_time;
        localStorage.setItem("clinicToken", tokenNumber);
        localStorage.setItem("appointmentDate", appointmentDate);
        localStorage.setItem("appointmentTime", appointmentTime);
    }

    async function loadCurrentAppointment() {
        try {
            const response = await fetch("/api/appointments/current", {
                credentials: "include"
            });

            if (!response.ok) return null;

            const result = await response.json();
            if (result.appointment) {
                applyAppointment(result.appointment);
            } else {
                tokenNumber = null;
                localStorage.removeItem("clinicToken");
            }
            return result.appointment;
        } catch (error) {
            return null;
        }
    }

    async function generateToken() {
        const dateInput = document.getElementById("appointmentDate");
        const selectedDate = dateInput ? dateInput.value : "";
        const selectedTime = getAppointmentTime();

        if (!selectedDate) {
            alert("Please select an appointment date.");
            return;
        }

        const response = await fetch("/api/appointments", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                doctorId: selectedDoctor.id,
                appointmentDate: selectedDate,
                appointmentTime: selectedTime
            })
        });

        const result = await response.json();
        if (!response.ok) {
            alert(result.error || "Unable to create the appointment.");
            return;
        }

        applyAppointment(result.appointment);

        localStorage.setItem(
            "patientName",
            patientName
        );

        renderPatientView();
        renderWaitingHall();
        renderStaffDashboard();
        showPatientView();
    }


    /* ============================================================
       CURRENT DATE
       ============================================================ */

    function getFormattedDate() {

        const savedDate =
            document.getElementById("appointmentDate");

        if (
            savedDate &&
            savedDate.value
        ) {

            const date =
                new Date(savedDate.value);

            if (!isNaN(date.getTime())) {

                return date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );

            }

        }

        return new Date().toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric"
            }
        );

    }


    /* ============================================================
       APPOINTMENT TIME
       ============================================================ */

    function getAppointmentTime() {

        const timeInput =
            document.getElementById("appointmentTime");

        if (
            timeInput &&
            timeInput.value
        ) {

            return timeInput.value;

        }

        return "09:00 AM";

    }


    /* ============================================================
       PATIENT VIEW
       ============================================================ */

    function renderPatientView() {

        const patientView =
            document.getElementById("patientView") ||
            document.getElementById("patientDashboard");

        if (!patientView) return;

        if (!tokenNumber) {

            patientView.innerHTML = `

                <div class="glass-card main-card">

                    <span class="pill-tag">
                        SELF-SERVICE KIOSK
                    </span>

                    <div class="card-header">

                        <h2>
                            Take Your Digital Token
                        </h2>

                        <p class="card-desc">
                            Select your doctor and appointment
                            details to generate your digital token.
                        </p>

                    </div>

                    <div class="kiosk-form">

                        <div class="form-group">

                            <label>
                                Patient Name
                            </label>

                            <input
                                id="tokenPatientName"
                                type="text"
                                placeholder="Enter patient name"
                                value="${patientName}"
                            >

                        </div>


                        <div class="form-group">

                            <label>
                                Choose Doctor
                            </label>

                            <div
                                class="doctor-cards-grid"
                                id="doctorSelection"
                            >

                                ${createDoctorCards()}

                            </div>

                        </div>


                        <div class="form-group">

                            <label>
                                Select Date
                            </label>

                            <div class="appointment-calendar">

                                <input
                                    type="text"
                                    id="appointmentDate"
                                    placeholder="Choose an appointment date"
                                    readonly
                                    aria-label="Selected appointment date">

                                <button
                                    type="button"
                                    class="calendar-toggle"
                                    id="calendarToggle"
                                    aria-expanded="false">
                                    Choose Date
                                </button>

                                <div
                                    class="calendar-picker"
                                    id="calendarPicker"
                                    hidden>

                                    <div class="calendar-header">
                                        <button type="button" class="calendar-nav" id="calendarPrevious" aria-label="Previous month">&lt;</button>
                                        <strong id="calendarMonthYear"></strong>
                                        <button type="button" class="calendar-nav" id="calendarNext" aria-label="Next month">&gt;</button>
                                    </div>

                                    <div class="calendar-weekdays" aria-hidden="true">
                                        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                                    </div>

                                    <div class="calendar-days" id="calendarDays"></div>

                                </div>

                            </div>

                        </div>


                        <div class="form-group">

                            <label>
                                Select Time
                            </label>

                            <select
                                id="appointmentTime"
                            >

                                <option>
                                    09:00 AM
                                </option>

                                <option>
                                    10:00 AM
                                </option>

                                <option>
                                    11:00 AM
                                </option>

                                <option>
                                    12:00 PM
                                </option>

                                <option>
                                    02:00 PM
                                </option>

                                <option>
                                    03:00 PM
                                </option>

                                <option>
                                    04:00 PM
                                </option>

                                <option>
                                    05:00 PM
                                </option>

                            </select>

                        </div>


                        <button
                            class="glow-button"
                            id="getTokenButton"
                        >

                            🎟️ Get Your Token

                        </button>

                    </div>

                </div>

            `;

            attachTokenEvents();
            attachCalendarEvents();

            return;
        }


        /* ========================================================
           OLD / PREMIUM TOKEN DISPLAY
           ======================================================== */

        const peopleAhead =
            selectedDoctor.nextTokens.length > 0
                ? selectedDoctor.nextTokens.indexOf(tokenNumber)
                : 0;

        const estimatedMinutes =
            Math.max(0, peopleAhead * 10);

        const progress =
            peopleAhead === 0
                ? 100
                : Math.max(
                    20,
                    100 - (peopleAhead * 20)
                );


        patientView.innerHTML = `

            <div class="glass-card token-view-card">

                <!-- TOP ALERT -->

                <div class="turn-alert-banner">

                    <div class="alert-icon-wrap">
                        🔔
                    </div>

                    <div class="alert-text">

                        <strong>
                            Your token is active
                        </strong>

                        <p>
                            Please keep this page open
                            to monitor your queue.
                        </p>

                    </div>

                </div>


                <!-- DIGITAL TICKET -->

                <div class="glass-ticket">

                    <!-- TICKET HEADER -->

                    <div class="ticket-header">

                        <div>

                            <div class="clinic-sub-label">
                                QSMART CARECLINIC
                            </div>

                            <h3>
                                ${selectedDoctor.name}
                            </h3>

                            <div class="ticket-dept">

                                ${selectedDoctor.department}
                                •
                                ${selectedDoctor.room}

                            </div>

                        </div>


                        <div style="text-align:right">

                            <div id="liveClock">
                                ${getCurrentTime()}
                            </div>

                            <span class="pill-tag">
                                ● ACTIVE
                            </span>

                        </div>

                    </div>


                    <!-- TOKEN NUMBER -->

                    <div
                        style="
                        text-align:center;
                        padding:40px 20px 30px;
                        "
                    >

                        <div
                            style="
                            color:#94a3b8;
                            font-size:15px;
                            font-weight:700;
                            letter-spacing:2px;
                            "
                        >
                            YOUR TOKEN NUMBER
                        </div>


                        <div
                            style="
                            font-size:78px;
                            font-weight:800;
                            color:#00f2fe;
                            text-shadow:
                            0 0 25px
                            rgba(0,242,254,0.45);
                            margin:5px 0;
                            "
                        >

                            ${tokenNumber}

                        </div>


                        <div
                            style="
                            font-size:18px;
                            color:#cbd5e1;
                            "
                        >

                            Patient:
                            <strong>
                                ${patientName}
                            </strong>

                        </div>

                    </div>


                    <!-- QUEUE INFORMATION -->

                    <div
                        style="
                        display:grid;
                        grid-template-columns:
                        repeat(3,1fr);
                        gap:16px;
                        padding:0 28px 28px;
                        "
                    >

                        <div class="queue-info-card">

                            <span>
                                ▶
                            </span>

                            <small>
                                CURRENTLY SERVING
                            </small>

                            <strong>
                                ${selectedDoctor.currentToken}
                            </strong>

                        </div>


                        <div class="queue-info-card">

                            <span>
                                👥
                            </span>

                            <small>
                                PEOPLE AHEAD
                            </small>

                            <strong>
                                ${peopleAhead}
                            </strong>

                        </div>


                        <div class="queue-info-card">

                            <span>
                                ◷
                            </span>

                            <small>
                                ESTIMATED WAIT TIME
                            </small>

                            <strong>
                                ~ ${estimatedMinutes} mins
                            </strong>

                        </div>

                    </div>


                    <!-- PROGRESS -->

                    <div
                        style="
                        padding:0 28px 30px;
                        "
                    >

                        <div
                            style="
                            display:flex;
                            justify-content:
                            space-between;
                            margin-bottom:10px;
                            color:#94a3b8;
                            "
                        >

                            <span>
                                Queue Progress
                            </span>

                            <span>
                                ${peopleAhead} ahead
                            </span>

                        </div>


                        <div
                            style="
                            height:10px;
                            background:#1e293b;
                            border-radius:20px;
                            overflow:hidden;
                            "
                        >

                            <div
                                style="
                                width:${progress}%;
                                height:100%;
                                background:
                                linear-gradient(
                                90deg,
                                #00f2fe,
                                #10b981
                                );
                                border-radius:20px;
                                "
                            ></div>

                        </div>


                        <div
                            style="
                            text-align:center;
                            margin-top:20px;
                            "
                        >

                            <span class="pill-tag">

                                Waiting in Queue
                                (${peopleAhead} ahead)

                            </span>

                        </div>

                    </div>


                    <!-- FOOTER -->

                    <div
                        style="
                        border-top:
                        1px dashed
                        rgba(255,255,255,0.15);

                        padding:
                        20px 28px;

                        display:flex;
                        justify-content:
                        space-between;

                        align-items:center;

                        gap:15px;

                        flex-wrap:wrap;
                        "
                    >

                        <div>

                            💡 Feel free to wait in the
                            cafeteria or parking area.

                            <br>

                            <span
                                style="
                                color:#94a3b8;
                                font-size:13px;
                                "
                            >
                                This page refreshes
                                automatically.
                            </span>

                        </div>


                        <div
                            style="
                            display:flex;
                            gap:10px;
                            "
                        >

                            <button
                                class="secondary-button"
                                id="cancelTokenBtn"
                            >
                                Cancel Token
                            </button>


                            <button
                                class="glow-button"
                                id="newTokenBtn"
                            >
                                New Token
                            </button>

                        </div>

                    </div>

                </div>

            </div>

        `;


        attachTokenDisplayEvents();

        startLiveClock();

    }


    /* ============================================================
       DOCTOR CARDS
       ============================================================ */

    function createDoctorCards() {

        return doctors.map(function (doctor) {

            return `

                <div
                    class="doctor-select-card
                    ${doctor.id === selectedDoctor.id
                    ? "selected"
                    : ""}"

                    data-doctor="${doctor.id}"
                >

                    <div class="doc-top">

                        <span style="font-size:28px">
                            👨‍⚕️
                        </span>

                        <span class="doc-room-badge">
                            ${doctor.room}
                        </span>

                    </div>

                    <div class="doc-name">
                        ${doctor.name}
                    </div>

                    <div class="doc-dept">
                        ${doctor.department}
                    </div>

                    <div class="doc-queue-brief">

                        <span>
                            Current
                        </span>

                        <strong>
                            ${doctor.currentToken}
                        </strong>

                    </div>

                </div>

            `;

        }).join("");

    }


    /* ============================================================
       TOKEN FORM EVENTS
       ============================================================ */

    function attachTokenEvents() {

        const doctorCards =
            document.querySelectorAll(
                ".doctor-select-card"
            );

        doctorCards.forEach(function (card) {

            card.addEventListener(
                "click",
                function () {

                    const doctorId =
                        card.dataset.doctor;

                    const doctor =
                        doctors.find(
                            d => d.id === doctorId
                        );

                    if (doctor) {

                        selectedDoctor = doctor;

                        doctorCards.forEach(
                            c =>
                            c.classList.remove(
                                "selected"
                            )
                        );

                        card.classList.add(
                            "selected"
                        );

                    }

                }
            );

        });


        const getTokenButton =
            document.getElementById(
                "getTokenButton"
            );


        if (getTokenButton) {

            getTokenButton.addEventListener(
                "click",
                async function () {

                    const nameInput =
                        document.getElementById(
                            "tokenPatientName"
                        );

                    if (
                        nameInput &&
                        nameInput.value.trim()
                    ) {

                        patientName =
                            nameInput.value.trim();

                    }

                    if (!patientName) {

                        alert(
                            "Please enter patient name."
                        );

                        return;

                    }

                    await generateToken();

                }
            );

        }

    }

    function attachCalendarEvents() {
        const dateInput = document.getElementById("appointmentDate");
        const toggle = document.getElementById("calendarToggle");
        const picker = document.getElementById("calendarPicker");
        const monthYear = document.getElementById("calendarMonthYear");
        const days = document.getElementById("calendarDays");
        const previous = document.getElementById("calendarPrevious");
        const next = document.getElementById("calendarNext");

        if (!dateInput || !toggle || !picker || !monthYear || !days || !previous || !next) return;

        const today = new Date();
        let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        function renderCalendar() {
            const year = displayedMonth.getFullYear();
            const month = displayedMonth.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            monthYear.textContent = displayedMonth.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric"
            });

            days.innerHTML = "";
            for (let index = 0; index < firstDay; index += 1) {
                days.appendChild(document.createElement("span"));
            }

            for (let day = 1; day <= daysInMonth; day += 1) {
                const button = document.createElement("button");
                const monthValue = String(month + 1).padStart(2, "0");
                const dayValue = String(day).padStart(2, "0");
                button.type = "button";
                button.className = "calendar-day";
                button.textContent = day;
                button.dataset.date = `${year}-${monthValue}-${dayValue}`;
                if (button.dataset.date === dateInput.value) button.classList.add("selected");
                button.addEventListener("click", function () {
                    dateInput.value = button.dataset.date;
                    toggle.textContent = dateInput.value;
                    picker.hidden = true;
                    toggle.setAttribute("aria-expanded", "false");
                });
                days.appendChild(button);
            }
        }

        toggle.addEventListener("click", function () {
            picker.hidden = !picker.hidden;
            toggle.setAttribute("aria-expanded", String(!picker.hidden));
            if (!picker.hidden) {
                renderCalendar();

                const calendarRect = picker.getBoundingClientRect();
                const fieldRect = dateInput.getBoundingClientRect();
                const safeTop = 8;
                const safeBottom = window.innerHeight - calendarRect.height - 8;
                const top = Math.max(safeTop, Math.min(fieldRect.bottom + 8, safeBottom));

                picker.style.top = `${top - fieldRect.top}px`;
            } else {
                picker.style.top = "calc(100% + 8px)";
            }
        });

        previous.addEventListener("click", function () {
            displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
            renderCalendar();
        });

        next.addEventListener("click", function () {
            displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
            renderCalendar();
        });

        renderCalendar();
    }


    /* ============================================================
       TOKEN DISPLAY BUTTONS
       ============================================================ */

    function attachTokenDisplayEvents() {

        const cancelButton =
            document.getElementById(
                "cancelTokenBtn"
            );

        const newTokenButton =
            document.getElementById(
                "newTokenBtn"
            );


        if (cancelButton) {

            cancelButton.addEventListener(
                "click",
                function () {

                    const confirmCancel =
                        confirm(
                            "Are you sure you want to cancel your token?"
                        );

                    if (!confirmCancel) return;

                    localStorage.removeItem(
                        "clinicToken"
                    );

                    tokenNumber = null;

                    renderPatientView();

                }
            );

        }


        if (newTokenButton) {

            newTokenButton.addEventListener(
                "click",
                function () {

                    localStorage.removeItem(
                        "clinicToken"
                    );

                    tokenNumber = null;

                    renderPatientView();

                }
            );

        }

    }


    /* ============================================================
       WAITING HALL DISPLAY
       ============================================================ */

    function renderWaitingHall() {

        const waitingHall =
            document.getElementById("waitingHall") ||
            document.getElementById("waitingDashboard");

        if (!waitingHall) return;


        waitingHall.innerHTML = `

            <div class="glass-card wide-card">

                <div class="waiting-header">

                    <div>

                        <span class="pill-tag red-tag">
                            LIVE CLINIC DISPLAY
                        </span>

                        <h2>
                            Waiting Room Token Board
                        </h2>

                        <p class="card-desc">
                            Real-time consultation status
                            across all clinic consulting rooms.
                        </p>

                    </div>

                    <div class="large-clock">
                        ${getCurrentTime()}
                    </div>

                </div>


                <div class="doctor-board-grid">

                    ${doctors.map(
                        doctor => `

                        <div class="doctor-board-card accent-${doctor.accent}">

                            <div class="doctor-board-header">

                                <div class="doctor-id-group">

                                    <div class="doctor-avatar">
                                        ${doctor.initials}
                                    </div>

                                    <div>

                                        <h3>
                                            ${doctor.name}
                                        </h3>

                                        <p>
                                            ${doctor.department}
                                        </p>

                                    </div>

                                </div>

                                <span
                                    class="room-badge"
                                >
                                    ${doctor.roomShort}
                                </span>

                            </div>


                            <div
                                class="currently-serving-area"
                            >

                                <div>
                                    CURRENTLY SERVING
                                </div>

                                <strong>
                                    ${doctor.currentToken}
                                </strong>

                                <p>
                                    Patient:
                                    ${doctor.currentPatient}
                                </p>

                            </div>


                            <div class="next-queue">

                                <span>
                                    Next in Queue
                                </span>

                                <div>

                                    ${
                                        doctor.nextTokens.length
                                        ?
                                        doctor.nextTokens
                                        .slice(0, 4)
                                        .map(
                                            token =>
                                            `<span>${token}</span>`
                                        )
                                        .join("")
                                        :
                                        `<span class="queue-empty">
                                            Queue empty
                                        </span>`
                                    }

                                </div>

                            </div>

                        </div>

                    `).join("")}

                </div>

            </div>

        `;

    }


    /* ============================================================
       STAFF DASHBOARD
       ============================================================ */

    async function refreshStaffDashboardData() {
        if (!(currentUser.authenticated && currentUser.isStaff)) return;

        const query = `?doctorId=${encodeURIComponent(selectedDoctor.id)}`;
        const [queueResponse, historyResponse] = await Promise.all([
            fetch(`/api/queue/waiting${query}`, { credentials: "include" }),
            fetch(`/api/queue/history${query}`, { credentials: "include" })
        ]);

        if (queueResponse.status === 401 || queueResponse.status === 403) {
            showPage("loginPage");
            return;
        }
        if (!queueResponse.ok || !historyResponse.ok) return;

        const queueResult = await queueResponse.json();
        const historyResult = await historyResponse.json();
        staffQueue = queueResult.appointments || [];
        staffHistory = historyResult.appointments || [];
        renderStaffDashboard();
    }

    function renderStaffDashboard() {

        const staffDashboard =
            document.getElementById("staffDashboard");

        if (!staffDashboard) return;


        staffDashboard.innerHTML = `

            <div
                class="staff-layout"
            >

                <!-- LEFT SIDE -->

                <div class="glass-card staff-selection">

                    <span class="pill-tag blue-tag">
                        STAFF CONSOLE
                    </span>

                    <h2>
                        Doctor & Room
                        Selection
                    </h2>


                    <div
                        class="form-group"
                        style="margin-top:25px"
                    >

                        <label>
                            Select Operating Doctor
                        </label>

                        <select
                            id="staffDoctorSelect"
                            class="glass-select"
                        >

                            ${doctors.map(
                                doctor =>
                                `
                                <option
                                    value="${doctor.id}"
                                    ${
                                    doctor.id ===
                                    selectedDoctor.id
                                    ? "selected"
                                    : ""
                                    }
                                >
                                    ${doctor.name}
                                    (${doctor.roomShort})
                                </option>
                                `
                            ).join("")}

                        </select>

                    </div>


                    <div
                        class="current-consultation accent-${selectedDoctor.accent}"
                    >

                        <span>
                            NOW CONSULTING
                            IN THIS ROOM
                        </span>

                        <strong>
                            ${selectedDoctor.currentToken}
                        </strong>

                        <p>
                            Patient:
                            ${selectedDoctor.currentPatient}
                        </p>

                        <div class="consult-timer">
                            <span class="timer-dot"></span>
                            In consultation:
                            ~${selectedDoctor.consultMinutes} min
                        </div>

                    </div>


                    <button
                        class="call-next-button"
                        id="callNextPatient"
                    >

                        ▶
                        Call Next Patient

                    </button>


                    <div class="staff-action-grid">

                        <button
                            class="recall-button"
                            id="recallButton"
                        >
                            🔔
                            <span>
                                Recall /
                                Re-Announce
                            </span>
                        </button>


                        <button
                            class="complete-button"
                            id="completeButton"
                        >
                            ✓
                            <span>
                                Complete Visit
                            </span>
                        </button>

                    </div>

                </div>


                <!-- RIGHT SIDE -->

                <div class="glass-card queue-management">

                    <div
                        class="staff-tabs"
                    >

                        <button class="staff-tab ${activeStaffView === "waiting" ? "active" : ""}" data-staff-view="waiting">
                            Waiting Queue
                            (${staffQueue.length})
                        </button>

                        <button class="staff-tab ${activeStaffView === "history" ? "active" : ""}" data-staff-view="history">
                            Today's History
                            (${staffHistory.length})
                        </button>

                    </div>


                    <div class="queue-table-wrapper">

                        ${
                            (activeStaffView === "waiting" ? staffQueue.length === 0 : staffHistory.length === 0)
                            ? `
                                <div class="queue-empty-state">
                                    <div class="queue-empty-icon">◌</div>
                                    <strong>${activeStaffView === "waiting" ? "No one is waiting" : "No completed visits today"}</strong>
                                    <p>${activeStaffView === "waiting" ? "New tokens for this room will appear here." : "Completed visits will appear here."}</p>
                                </div>
                            `
                            : `
                                <table class="queue-table">

                                    <thead>
                                        <tr>
                                            <th>TOKEN #</th>
                                            <th>PATIENT NAME</th>
                                            <th>CREATED</th>
                                            <th>EST. WAIT</th>
                                            <th>ACTION</th>
                                        </tr>
                                    </thead>

                                    <tbody>

                                        ${
                                            (activeStaffView === "waiting" ? staffQueue : staffHistory)
                                            .map(
                                                (appointment, index) => {

                                                    const token = appointment.token_number;
                                                    const name = appointment.patient_name || "Patient";

                                                    const waitClass =
                                                        index === 0
                                                        ? "wait-pill wait-now"
                                                        : "wait-pill";

                                                    return `

                                                    <tr>

                                                        <td>
                                                            <span class="table-token">
                                                                ${token}
                                                            </span>
                                                        </td>

                                                        <td>
                                                            <div class="patient-cell">
                                                                <span class="patient-avatar">
                                                                    ${getInitials(name)}
                                                                </span>
                                                                ${name}
                                                            </div>
                                                        </td>

                                                        <td>
                                                            ${appointment.completed_at || appointment.created_at}
                                                        </td>

                                                        <td>
                                                            <span class="${waitClass}">
                                                                ${activeStaffView === "waiting" ? `~${index * 10}m` : "Completed"}
                                                            </span>
                                                        </td>

                                                        <td>
                                                            ${activeStaffView === "waiting"
                                                                ? `<button class="call-now-button" data-call-token="${token}">
                                                                    Call Now
                                                                </button>`
                                                                : "Completed"}
                                                        </td>

                                                    </tr>

                                                    `;

                                                }
                                            )
                                            .join("")
                                        }

                                    </tbody>

                                </table>
                            `
                        }

                    </div>

                </div>

            </div>

        `;


        const doctorSelect =
            document.getElementById(
                "staffDoctorSelect"
            );


        if (doctorSelect) {

            doctorSelect.addEventListener(
                "change",
                function () {

                    const doctor =
                        doctors.find(
                            d =>
                            d.id ===
                            doctorSelect.value
                        );

                    if (doctor) {

                        selectedDoctor = doctor;

                        renderStaffDashboard();
                        renderPatientView();
                        refreshStaffDashboardData();

                    }

                }
            );

        }


        const callNext =
            document.getElementById(
                "callNextPatient"
            );


        if (callNext) {

            callNext.addEventListener(
                "click",
                async function () {
                    const result = await callStaffApi("/api/queue/call-next", {
                        doctorId: selectedDoctor.id
                    });
                    if (!result) return;

                    selectedDoctor.currentToken = result.appointment.token_number;
                    selectedDoctor.currentPatient = result.appointment.patient_name || "Patient";
                    selectedDoctor.consultMinutes = 0;
                    await refreshStaffDashboardData();
                    renderWaitingHall();
                    renderPatientView();
                }
            );

        }


        const completeButton =
            document.getElementById(
                "completeButton"
            );


        if (completeButton) {

            completeButton.addEventListener(
                "click",
                async function () {
                    const result = await callStaffApi("/api/queue/complete", {
                        doctorId: selectedDoctor.id,
                        token: selectedDoctor.currentToken
                    });
                    if (!result) return;
                    alert("Visit completed successfully.");
                    await refreshStaffDashboardData();
                }
            );

        }


        const recallButton =
            document.getElementById(
                "recallButton"
            );


        if (recallButton) {

            recallButton.addEventListener(
                "click",
                function () {

                    alert(
                        "Patient has been re-announced."
                    );

                }
            );

        }


        staffDashboard
            .querySelectorAll("[data-call-token]")
            .forEach(function (button) {

                button.addEventListener(
                    "click",
                    async function () {
                        await window.callSpecificPatient(button.dataset.callToken);
                    }
                );

            });

        staffDashboard
            .querySelectorAll("[data-staff-view]")
            .forEach(function (button) {
                button.addEventListener("click", async function () {
                    activeStaffView = button.dataset.staffView;
                    await refreshStaffDashboardData();
                });
            });

    }


    /* ============================================================
       NAVIGATION BETWEEN THIRD-PAGE VIEWS
       ============================================================ */

    document.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    "[data-view]"
                );

            if (!button) return;

            const view =
                button.dataset.view;

            showThirdPageView(view);

        }
    );


    function showThirdPageView(view) {

        const patientView =
            document.getElementById("patientView") ||
            document.getElementById("patientDashboard");

        const waitingHall =
            document.getElementById("waitingHall") ||
            document.getElementById("waitingDashboard");

        const staffDashboard =
            document.getElementById("staffDashboard");


        if (patientView)
            patientView.classList.remove(
                "active"
            );

        if (waitingHall)
            waitingHall.classList.remove(
                "active"
            );

        if (staffDashboard)
            staffDashboard.classList.remove(
                "active"
            );


        const selectedTab =
            document.querySelectorAll(
                "[data-view]"
            );

        selectedTab.forEach(
            tab =>
            tab.classList.remove("active")
        );


        if (view === "patient") {

            if (patientView)
                patientView.classList.add(
                    "active"
                );

        }


        if (view === "waiting") {

            if (waitingHall)
                waitingHall.classList.add(
                    "active"
                );

        }


        if (view === "staff") {

            if (staffDashboard)
                staffDashboard.classList.add(
                    "active"
                );

        }


        document
            .querySelectorAll(
                `[data-view="${view}"]`
            )
            .forEach(
                tab =>
                tab.classList.add("active")
            );

    }


    /* ============================================================
       CLOCK
       ============================================================ */

    function getCurrentTime() {

        return new Date().toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );

    }


    function startLiveClock() {

        setInterval(
            function () {

                const clock =
                    document.getElementById(
                        "liveClock"
                    );

                if (clock) {

                    clock.textContent =
                        getCurrentTime();

                }

                const hallClock =
                    document.querySelector(
                        "#waitingDashboard .large-clock"
                    );

                if (hallClock) {

                    hallClock.textContent =
                        getCurrentTime();

                }

            },
            1000
        );

    }

    window.cancelToken = function () {
        const confirmCancel = confirm("Are you sure you want to cancel your token?");

        if (!confirmCancel) return;

        localStorage.removeItem("clinicToken");
        tokenNumber = null;
        renderPatientView();
    };

    window.startNewToken = function () {
        localStorage.removeItem("clinicToken");
        tokenNumber = null;
        renderPatientView();
    };

    window.callNextPatient = async function () {
        const result = await callStaffApi("/api/queue/call-next", {
            doctorId: selectedDoctor.id
        });
        if (!result) return; // 401/403 redirected, or the call failed

        selectedDoctor.currentToken = result.appointment.token_number;
        selectedDoctor.currentPatient = result.appointment.patient_name || "Patient";
        await refreshStaffDashboardData();
        renderWaitingHall();
        renderPatientView();
    };

    window.recallPatient = async function () {
        const result = await callStaffApi("/api/queue/recall", {
            doctorId: selectedDoctor.id,
            token: selectedDoctor.currentToken
        });
        if (!result) return;
        alert("Patient has been re-announced.");
    };

    window.completeVisit = async function () {
        const result = await callStaffApi("/api/queue/complete", {
            doctorId: selectedDoctor.id,
            token: selectedDoctor.currentToken
        });
        if (!result) return;
        alert("Visit completed successfully.");
        await refreshStaffDashboardData();
    };

    window.callSpecificPatient = async function (token) {
        const result = await callStaffApi("/api/queue/call-specific", {
            doctorId: selectedDoctor.id,
            token: token
        });
        if (!result) return;
        selectedDoctor.currentToken = result.appointment.token_number;
        selectedDoctor.currentPatient = result.appointment.patient_name || "Patient";
        renderStaffDashboard();
        renderWaitingHall();
        alert("Calling " + token + " now.");
        await refreshStaffDashboardData();
    };

    window.showThirdPageView = showThirdPageView;


    /* ============================================================
       LIVE CLOCK FOR WAITING HALL (runs regardless of active page)
       ============================================================ */

    setInterval(function () {

        const hallClock =
            document.querySelector(
                "#waitingDashboard .large-clock"
            );

        if (hallClock) {

            hallClock.textContent = getCurrentTime();

        }

    }, 1000);


    /* ============================================================
       INITIAL PAGE
       ============================================================ */

    async function initialize() {
        const user = await refreshAuthStatus();
        if (user.authenticated && user.role === "patient") {
            await loadCurrentAppointment();
            showPage("token");
            return;
        }
        if (user.authenticated && user.role === "staff") {
            showPage("token");
            showDashboard("staff");
            return;
        }
        showPage("welcome");
    }

    initialize();

});