# IAC Critical Supplies Dashboard

This is a simple web application to track critical supplies for the IAC (International Astronautical Congress) 2025 paper.

## Tech Stack

*   HTML
*   CSS
*   JavaScript (ES6 Modules)

## Project Structure

*   `app.js`: Main application file, including seed data.
*   `index.html`: Main HTML file.
*   `styles.css`: CSS styles.
*   `domain/`: Contains the core business logic and entities.
*   `erp/`: This folder contains the backend scripts intended for a NetSuite implementation. Due to the lack of a NetSuite license, these scripts are not currently in use. This web application serves as a frontend that mimics the intended functionality, operating with local data instead of a live backend.
*   `services/`: Contains the application's services.
*   `store/`: Contains the data storage logic (using LocalStorage).
*   `ui/`: Contains the UI components.
*   `utils/`: Contains utility functions.

## Getting Started

1.  Open `index.html` in your web browser.
2.  The application uses LocalStorage to store data.
3.  To reset the data, click the "Reset Demo Data" button in the footer.
