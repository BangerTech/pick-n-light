# Pick´n´Light

![Bildschirmfoto 2024-12-16 um 09 18 44](https://github.com/user-attachments/assets/0564ff97-ed78-40d9-92aa-f16844954e25)


# 1. Table of content
- [1. Table of content](#1-table-of-content)
- [2. What is this Plugin?](#2-what-is-this-plugin)
- [3. Setup](#3-setup)
- [4. How to use it?](#5-how-to-use-it)
- [5. Support / Feedback](#4-support--feedback)
- [6. How to contribute?](#6-how-to-contribute)
- [7. Sponsor me!](#7-how-to-sponsor)

# 2. What is this?

This Node-RED based tool is a sophisticated inventory management system that integrates with LED strips to create a "Pick and Light" solution. It's designed to streamline inventory tracking and item location in warehouses or storage facilities.

### Key Features

1. **LED-Guided Picking**: The system uses LED strips to visually indicate the location of items in storage.

2. **Real-Time Inventory Tracking**: It maintains up-to-date information on item locations and quantities.

3. **User Interface**: A dashboard allows users to input and retrieve inventory data easily.

4. **Database Integration**: Connects to a MySQL database for persistent storage of inventory information.

5. **MQTT Communication**: Utilizes MQTT for real-time updates and control of the LED system.

6. **HTTP API**: Provides endpoints for external systems to interact with the inventory data.

### How It Works

1. **Item Lookup**: When a user searches for an item, the system queries the database for its location.

2. **Visual Indication**: The corresponding LED strip segment lights up, guiding the user to the correct shelf or bin.

3. **Automatic Shutdown**: LEDs turn off automatically after a set period to conserve energy.

4. **Data Collection**: The system collects and stores information about each pick operation.

5. **Flexible Configuration**: Users can adjust LED strip length and shelf width through the dashboard.

### Use Cases

- **Warehouse Management**: Speeds up order picking and reduces errors in large warehouses.
- **Retail Stockrooms**: Helps staff quickly locate items for restocking or customer requests.
- **Manufacturing**: Assists in locating parts or components in assembly lines.
- **Libraries**: Aids in finding books or resources in large collections.

### Benefits

- **Increased Efficiency**: Reduces time spent searching for items.
- **Error Reduction**: Minimizes picking errors by providing visual guidance.
- **Scalability**: Can be adapted to various storage layouts and sizes.
- **Integration**: Easily integrates with existing inventory management systems.

This tool combines hardware (LED strips) with software (Node-RED flows) to create a powerful, user-friendly inventory management solution that can significantly improve operational efficiency in various storage and retrieval scenarios.

# 3. Setup & Requirements
- Linux System
- Docker and Docker Compose installed

# 4. How to use it?

1. Create and Run Node-Red Container with the provided docker-compose.yml file

2. Import Node-Red Flows and adapt them to your system (mqtt settings etc.)

3. Create Part-DB Container with the provided docker-compose.yml file

4. Adapt the environment Variables accordingly

5. First start the Container with the Default Database:
   - DATABASE_URL=sqlite:///%kernel.project_dir%/var/db/app.db

6. Create and Run MariaDB Container with the provided docker-compose.yml file

7. Jump into the Container with:
   ```
   docker exec -it mariadb mariadb -u root -p
   ```

8. Create and use Database partdb:
   ```sql
   CREATE DATABASE IF NOT EXISTS partdb;
   USE partdb;
   ```

9. Create new Table:
   ```sql
   CREATE TABLE IF NOT EXISTS led_mapping (
   part_id INT PRIMARY KEY,
   led_position INT NOT NULL,
   UNIQUE (led_position)
   );
   ```

10. Proof:
    ```sql
    SHOW TABLES;
    DESCRIBE parts;
    DESCRIBE led_mapping;
    SHOW TRIGGERS;
    ```

11. Exit Container with: `exit`

12. Import the two Triggers with the provided Trigger.sql files

13. Stop the PartDB Container

14. Change the PartDB docker-compose.yml and update the Database_URL to:
    - DATABASE_URL=mysql://partdb:root@mariadb:3306/partdb

15. Start the PartDB Container

16. Jump into Container and migrate the Database:
    ```
    docker exec --user=www-data partdb php bin/console doctrine:migrations:migrate
    ```

17. Install the ViolentMonkey Browser extension

18. Import the ViolentMonkey scripts from the provided file

19. HAVE FUN SORTING THINGS



# 5. Support / Feedback
Any bugs? Feature request? Message me [here](https://github.com/bangertech) or click on the "Issues" tab here on the GitHub repository!

# 6. How to contribute?

Fork the repository and create PR's.

# 7 How to sponsor?


<a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=FD26FHKRWS3US" target="_blank"><img src="https://pics.paypal.com/00/s/N2EwMzk4NzUtOTQ4Yy00Yjc4LWIwYmUtMTA3MWExNWIzYzMz/file.PNG" alt="SUPPORT" height="51"></a>

