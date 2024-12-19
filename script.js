document.addEventListener('DOMContentLoaded', function () {
  const setDayBtn = document.getElementById('setDayBtn');
  const addTaskBtn = document.getElementById('addTaskBtn');
  const saveScheduleBtn = document.getElementById('saveScheduleBtn');
  const darkModeBtn = document.getElementById('darkModeBtn');
  const startOverBtn = document.getElementById('startOverBtn');
  const scheduleModal = document.getElementById('scheduleModal');
  const selectedDateDisplay = document.getElementById('selectedDate');
  const closeButton = document.querySelector('.close-button');
  const taskSection = document.querySelector('.task-section');
  const scheduleSection = document.querySelector('.schedule-section');
  const inputSection = document.querySelector('.input-section')

  let schedules = JSON.parse(localStorage.getItem('schedules')) || {};
  let selectedDate = null;

  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    dateClick: function (info) {
      selectedDate = info.dateStr;
      selectedDateDisplay.textContent = selectedDate;

      // Check if a schedule exists for the date
      if (schedules[selectedDate]) {
        // If it exists, populate the time fields based on the schedule
        const firstTask = schedules[selectedDate][0];
        const lastTask = schedules[selectedDate][schedules[selectedDate].length - 1];

        const wakeUp = firstTask ? firstTask.startTime.slice(0, -3) : "07:00"; // Extract HH:MM
        const bedTime = lastTask ? lastTask.endTime.slice(0, -3) : "22:00"; // Extract HH:MM

        document.getElementById('wakeUpTime').value = wakeUp;
        document.getElementById('bedTime').value = bedTime;

        // Render the schedule immediately upon clicking the date
        setDay(selectedDate); // This will set up tasks and times based on the schedule
        renderSchedule();
        inputSection.style.display = "none";
        taskSection.style.display = "block";
        scheduleSection.style.display = "block";
      } else {
        // If no schedule, use default times
        document.getElementById('wakeUpTime').value = "07:00";
        document.getElementById('bedTime').value = "22:00";

        // Start fresh if no schedule exists
        startOver();
        inputSection.style.display = "block";
        taskSection.style.display = "none";
        scheduleSection.style.display = "none";
      }

      openModal(); // Open the modal
    },
    // Add this to highlight days with schedules
    dayCellDidMount: function(arg) {
        const date = arg.date;
        const dateString = date.toISOString().split('T')[0]; // Convert to 'YYYY-MM-DD' format

        if (schedules[dateString]) {
            arg.el.classList.add('has-schedule'); // Add a class to the cell element
        }
    },
  });
  calendar.render();

  setDayBtn.addEventListener('click', () => setDay(selectedDate));
  addTaskBtn.addEventListener('click', addTask);
  saveScheduleBtn.addEventListener('click', saveSchedule);
  darkModeBtn.addEventListener('click', toggleDarkMode);
  startOverBtn.addEventListener('click', startOver);
  closeButton.addEventListener('click', closeModal);

  let wakeUpTime = null;
  let bedTime = null;
  let tasks = [];
  let totalMinutesAvailable = 0;
  let totalMinutesUsed = 0;

  function setDay(date) {
    const wakeUp = document.getElementById('wakeUpTime').value;
    const bed = document.getElementById('bedTime').value;
    const errorMessage = document.getElementById('errorMessage');

    if (!wakeUp || !bed) {
      showError("Please set both wake-up and bed times.");
      return;
    }

    wakeUpTime = timeToMinutes(wakeUp);
    bedTime = timeToMinutes(bed);

    if (wakeUpTime >= bedTime) {
      showError("Bedtime must be later than wake-up time.");
      return;
    }

    totalMinutesAvailable = bedTime - wakeUpTime;

    // If there's an existing schedule for the date, load it
    if (schedules[date]) {
      tasks = [...schedules[date]];
      totalMinutesUsed = tasks.reduce((total, task) => total + task.duration, 0);
    } else {
      tasks = [];
      totalMinutesUsed = 0;
    }

    // Show task section and schedule section, hide input section
    taskSection.style.display = "block";
    scheduleSection.style.display = "block";
    inputSection.style.display = "none";
    errorMessage.textContent = '';

    renderSchedule();
    updateCalendarHighlights();
  }

  function addTask() {
    const taskName = document.getElementById('taskName').value;
    const taskDurationHours = parseInt(document.getElementById('taskDurationHours').value) || 0;
    const taskDurationMinutes = parseInt(document.getElementById('taskDurationMinutes').value) || 0;
    const taskDuration = (taskDurationHours * 60) + taskDurationMinutes;
    const errorMessage = document.getElementById('errorMessage');

    if (!taskName || isNaN(taskDuration) || taskDuration <= 0) {
      showError("Please provide a valid task name and duration.");
      return;
    }

    if (totalMinutesUsed + taskDuration > totalMinutesAvailable) {
      showError(`Not enough time left. You have ${totalMinutesAvailable - totalMinutesUsed} minutes remaining.`);
      return;
    }

    const startTime = minutesToTime(wakeUpTime + totalMinutesUsed);
    const endTime = minutesToTime(wakeUpTime + totalMinutesUsed + taskDuration);

    const newTask = { taskName, startTime, endTime, duration: taskDuration };

    // Push the new task to the tasks array
    tasks.push(newTask);

    // Update total minutes used
    totalMinutesUsed += taskDuration;

    // Update the schedule for the selected date in the schedules object
    schedules[selectedDate] = tasks;

    renderSchedule();

    // Reset the task input fields
    document.getElementById('taskName').value = '';
    document.getElementById('taskDurationHours').value = '';
    document.getElementById('taskDurationMinutes').value = '';
    errorMessage.textContent = '';
  }

  function renderSchedule() {
    const scheduleTableBody = document.querySelector('#scheduleTable tbody');
    scheduleTableBody.innerHTML = '';

    const currentTasks = schedules[selectedDate] || [];

    currentTasks.forEach((task, index) => {
      const row = scheduleTableBody.insertRow();
      const timeCell = row.insertCell();
      const taskCell = row.insertCell();
      const actionsCell = row.insertCell();

      timeCell.textContent = `${task.startTime} - ${task.endTime}`;
      taskCell.textContent = task.taskName;

      const editBtn = document.createElement('button');
      editBtn.classList.add('editBtn');
      editBtn.dataset.index = index;
      editBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
      editBtn.addEventListener('click', () => editTask(index));

      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('deleteBtn');
      deleteBtn.dataset.index = index;
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
      deleteBtn.addEventListener('click', () => deleteTask(index));

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
    });

    document.getElementById('saveScheduleBtn').disabled = currentTasks.length === 0;
  }

  function editTask(index) {
    const currentTasks = schedules[selectedDate];
    const task = currentTasks[index];

    // Calculate the hours and minutes from the task duration
    const hours = Math.floor(task.duration / 60);
    const minutes = task.duration % 60;

    // Populate the task input fields with the task details
    document.getElementById('taskName').value = task.taskName;
    document.getElementById('taskDurationHours').value = hours;
    document.getElementById('taskDurationMinutes').value = minutes;

    // Remove the task from the array and update the total minutes used
    totalMinutesUsed -= task.duration;
    currentTasks.splice(index, 1);

    // Update the schedule for the selected date
    schedules[selectedDate] = currentTasks;

    // Re-render the schedule to reflect the changes
    renderSchedule();
  }

  function deleteTask(index) {
    const currentTasks = schedules[selectedDate];
    const task = currentTasks[index];
    totalMinutesUsed -= task.duration;

    currentTasks.splice(index, 1);

    // Update the schedule for the selected date
    schedules[selectedDate] = currentTasks;

    renderSchedule();
  }

  function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  function minutesToTime(minutes) {
    let hours = Math.floor(minutes / 60);
    let mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Convert to 12-hour format
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
  }

  function showError(message) {
    document.getElementById('errorMessage').textContent = message;
  }

  function saveSchedule() {
    localStorage.setItem('schedules', JSON.stringify(schedules));
    alert('Schedule saved successfully!');
    updateCalendarHighlights();
  }

  function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
  }

  function startOver() {
    // Reset input fields
    document.getElementById('wakeUpTime').value = "07:00";
    document.getElementById('bedTime').value = "22:00";
    document.getElementById('taskName').value = '';
    document.getElementById('taskDurationHours').value = '';
    document.getElementById('taskDurationMinutes').value = '';
    // Reset tasks and time calculations
    tasks = [];
    totalMinutesAvailable = 0;
    totalMinutesUsed = 0;

    // Clear the schedule for the selected date
    if (schedules[selectedDate]) {
      schedules[selectedDate] = [];
    }

    // Show only the input section, hide others
    inputSection.style.display = "block";
    taskSection.style.display = "none";
    scheduleSection.style.display = "none";
    document.getElementById('errorMessage').textContent = '';

    // Clear the schedule table
    renderSchedule();
  }

  function openModal() {
    scheduleModal.style.display = "block";

    // If a schedule exists for the selected date, load the tasks
    if (schedules[selectedDate]) {
      tasks = [...schedules[selectedDate]];
      totalMinutesUsed = tasks.reduce((total, task) => total + task.duration, 0);

      // Populate wake-up and bed times from the loaded schedule
      if (tasks.length > 0) {
        const firstTask = tasks[0];
        const lastTask = tasks[tasks.length - 1];
        document.getElementById('wakeUpTime').value = firstTask.startTime.slice(0, -3);
        document.getElementById('bedTime').value = lastTask.endTime.slice(0, -3);

        // Set wakeUpTime and bedTime in minutes for calculations
        wakeUpTime = timeToMinutes(document.getElementById('wakeUpTime').value);
        bedTime = timeToMinutes(document.getElementById('bedTime').value);
        totalMinutesAvailable = bedTime - wakeUpTime;
      }

      // Show the schedule section and hide others
      inputSection.style.display = 'none';
      taskSection.style.display = 'block';
      scheduleSection.style.display = 'block';
      renderSchedule(); // Make sure the schedule is rendered
    } else {
      // If no schedule exists, initialize tasks as an empty array
      tasks = [];
      totalMinutesUsed = 0;

      // Show only the input section
      inputSection.style.display = 'block';
      taskSection.style.display = 'none';
      scheduleSection.style.display = 'none';
    }

    // Initialize or reset form fields
    document.getElementById('wakeUpTime').value = document.getElementById('wakeUpTime').value || "07:00";
    document.getElementById('bedTime').value = document.getElementById('bedTime').value || "22:00";
    document.getElementById('taskName').value = '';
    document.getElementById('taskDurationHours').value = '';
    document.getElementById('taskDurationMinutes').value = '';

    // Render or clear the schedule
    renderSchedule();
  }

  function closeModal() {
    scheduleModal.style.display = 'none';
  }

  function updateCalendarHighlights() {
    calendar.render(); // Re-render the calendar to apply new highlights
  }
});
