[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/UDc3mhmF)

# OKC Technical Project Deliverable

Your work must be your own and original. You may use AI tools to help aid your work if you include a single text file containing an ordered list of any AI prompts, along with the specific model queried (e.g. ChatGPT 5 Thinking) in the `prompts` directory. Do not include the AI's output.

### Internship Program Disclosures

* You must be eligible to work in the United States to be able to qualify for this internship.

* The pay for this internship is the greater of your local minimum wage and $13/hour.

* This application is for the purposes of an internship taking place in the Spring, Summer, or Fall of 2026.

### 1. Backend Engineering

* Architect and implement a normalized PostgreSQL database to store the data provided in `backend/raw_data`. All information from the original data should be accessible via the database.

* Write a brief description of your database architecture (<250 words). Feel free to provide a visual representation as an aid. Submit relevant responses in the `written_responses` folder provided.

* In the programming language of your choice, write a process to load the dataset into your PostgreSQL database. Ensure that this process can run repeatedly without duplicating or obscuring references in the database. Include the source code of your process in the `backend/scripts` folder. Note: You can feel free to utilize the power of Django models and migrations to achieve this step.

* After loading the data, export the state of your database using `pg_dump -U okcapplicant okc > dbexport.pgsql`. Include `dbexport.psql` in the `backend/scripts` folder.

* The skeleton of an API View `PlayerSummary` can be found in `backend/app/views/players.py`. This API View calls helper functions in `backend/app/helpers/players.py` to aggregate player stats and rank them.
  * Implement the `get_player_summary_stats` function to return a player summary that mimics the structure of `backend/app/helpers/sample_summary_data/sample_summary_data.json`.

  * Implement the `get_ranks` function to take a player's summary stats and calculate each stat's rank against the totals for all of the players included. This portion is optional, but a strong backend submission will typically implement both `get_player_summary_stats` and `get_ranks`.

* Feel free to import additional modules/libraries, but ensure that the `backend/requirements.txt` is updated accordingly. Viewing http://localhost:4200/player-summary-api allows you to see the output of your API, given the playerID parameter provided in the user input.

### 2. Frontend Engineering

* The `player-summary` component, which is viewable at http://localhost:4200/player-summary, makes a call to an API endpoint at `/api/v1/playerSummary/{playerID}` that returns player summary data. The player summary data is comprised of the individual shots, passes, and turnovers the player performed in specific halfcourt actions along with their totals across an entire season. The response also includes how the player's total counting stats each ranked against all players. Note that:

   * The x and y coordinates of the shots, passes, and turnovers provided are measured in feet
   * The location of each coordinate is relative to the center of the offensive basket, per `court_diagram.jpg` in this repository
   * The set of possible halfcourt actions are:
      * Pick & Roll
      * Isolation
      * Post-up
      * Off-Ball Screen

* Within the `player-summary` component found in `frontend/src/app/player-summary/`, create an interface that describes the data returned from the API.

* Feel free to import additional modules of your choice, and design the interface however you wish. Just make sure that the `package.json` and `package-lock.json` are updated accordingly.

* Upon completion of the Frontend Engineering deliverable, please attempt to deploy your project following the [deployment instructions](#deploying-through-railway) below and upload to this repo screenshots or screen captures that demonstrate your UI.


# Application Setup
In order to complete the Backend Engineering or Frontend Engineering deliverables, you will need to do all of the following setup items. Please follow the instructions below, from top to bottom sequentially, to ensure that you are set up to run the app. The app is run on an Angular frontend, Django backend, and a PostgreSQL database.

## Set up database
1. Download and install PostgreSQL from https://www.postgresql.org/download/
2. Ensure PostgreSQL is running, and in a terminal run
    ```
    createuser okcapplicant --createdb;
    createdb okc;
    ```
3. connect to the okc database:
    ```
    psql okc
    ```
4. Grant necessary permissions
    ```
    -- should be in the psql okc terminal with okc=#
    create schema app;
    alter user okcapplicant with password 'thunder';
    grant all on schema app to okcapplicant;
    ```


## Backend

### 1. Install pyenv and virtualenv

Read about pyenv here https://github.com/pyenv/pyenv as well as info on how to install it.
You may also need to install virtualenv in order to complete step 2.

### 2. Installing Prerequisites
The steps below attempt to install Python version 3.10.1 within your pyenv environment. If you computer is unable to install this particular version, you can feel free to use a version that works for you, but note that you may also be required to update existing parts of the codebase to make it compatible with your installed version.
```
cd root/of/project
pyenv install 3.10.1
pyenv virtualenv 3.10.1 okc
pyenv local okc
eval "$(pyenv init -)"
pyenv activate okc
pip install -r backend/requirements.txt
```

### 3. Starting the Backend
Start the backend by running the following commands
```
cd /path/to/project/backend
python manage.py runserver
```

You may ignore the warnings regarding the database not being set such as: `WARNING:root:No DATABASE_URL environment variable set, and so no databases setup`

The backend should run on http://localhost:8000/.


## Frontend

### 1. Installing Prerequisites
Install Node.js (16.x.x), then run the following commands
```
cd /path/to/project/frontend
# Install Angular-Cli
npm install -g @angular/cli@12.1.0 typescript@4.6.4 --force
# Install dependencies
npm install --force
```

### 2. Starting the Frontend
Start the frontend by running the following commands
```
cd /path/to/project/frontend
npm start
```
The frontend should run on http://localhost:4200/. Visit this address to see the app in your browser.

# Deploying through Railway

After you finish the project, we ask that you attempt to deploy your work to make it easily viewable in a browser. Below are instructions on deploying the app through Railway. It should not be necessary to give any credit card information to Railway as the deployment instructions are intended to solely utilize free services on the platform.

### 1. Install the Railway CLI
```
npm i -g @railway/cli
```
### 2. Login to the Railway CLI and create an account through your Github account in your browser
```
railway login
```
### 3. Initialize a Railway Project

Run the command below to create a project (you can use &lt;githubusername&gt;-thunder-2025 for your project name when prompted)
```
railway init
```
After the project is created, you can visit the link generated to view the Project's Architecture and modify the services we will generate in the following steps.

### 4. Add a Postgres instance to your project
Run the command below to add a Postgres instance to your Railway Project's architecture:
```
railway add --database postgres --service database
```

You should now see a "database" block in the Project Architecture interface. If not, you should be able to see it after refreshing the page.
**Wait for the Postgres instance to indicate that it has deployed successfully before moving onto the next step.**

### 5. Add a backend service and connect it to your app's Postgres instance
Run the command below as a single line:
```
railway add \
  --service backend \
  --variables 'DATABASE_URL=${{Postgres.DATABASE_URL}}' \
  --variables 'PGDATABASE=${{Postgres.PGDATABASE}}' \
  --variables 'PGHOST=${{Postgres.PGHOST}}' \
  --variables 'PGPASSWORD=${{Postgres.PGPASSWORD}}' \
  --variables 'PGPORT=${{Postgres.PGPORT}}' \
  --variables 'PGUSER=${{Postgres.PGUSER}}' \
  --variables 'DJANGO_SETTINGS_MODULE=app.settings'
```

You should now see a "backend" block in the Project Architecture interface. If not, you should be able to see it after refreshing the page.

### 6. Configure your backend service
- Select the backend service by clicking on the "backend" block in the Railway Project Architecture interface
- Connect your backend service to your project's Github repository by navigating to Settings and selecting "Connect Repo" in the Source section. From here, select your project's Github repo
- In the same Source section, set the root directory to `backend`
- In the Networking section select "Generate Domain" under Public Networking, and keep the port set as the default (8080)
- Put the same domain generated by the backend in `/path/to/project/frontend/src/environments/environment.prod.ts` **(including the https:// and ignoring the final forward slash / after the domain)** to allow the frontend that you will deploy to get responses from your backend. Make sure you push this change to your main branch

Ex: if the backend domain generated is `backend-thunder-technical.xyz.railway.app`, your `environment.prod.ts` should look like:
```
export const environment = {
  production: true,
  BACKEND_PUBLIC_DOMAIN: 'https://backend-thunder-technical.xyz.railway.app'
};
```

Once you finish configuring your backend service, you can apply the changes by selecting "Deploy" at the top of the interface.

If your backend service isn't able to successfully deploy, try deleting the service by navigating to the bottom of settings, selecting "Delete service", and deploying the destructive changes when prompted. Then try re-doing steps 5 and 6.

### 7. Add a frontend service
Run the command below to add a frontend service. Note: You won't need to add any variables for the frontend service, so you can press enter to skip that portion when prompted.
```
railway add --service frontend
```

You should now see a "frontend" block in the Project Architecture interface. If not, you should be able to see it after refreshing the page.

### 8. Configure your frontend service

- Connect your frontend service to your project's Github repository by clicking the "frontend" block in the Railway Project Architecture interface, navigating to Settings, and selecting "Connect Repo" in the Source section. From here, select your project's Github repo
- In the same Source section, set the root directory to `frontend`
- **Make sure the commit including the change to add your backend service's public domain to `environment.prod.ts` is pushed to your repo**
- In the Networking section select "Generate Domain" under Public Networking, and keep the port set as the default (8080)

Once you finish configuring your frontend service, you can apply the changes by selecting "Deploy" at the top of the interface.

Once deployed, your frontend should be accessible from the domain you generated, and it should be able to access your backend service. **Note down the domain generated for the frontend service in `SUBMISSION.md` as this will be the URL that allows us to access your project.**

### 9. Dump the contents of your local database to the Railway Postgres instance
```
cd /path/to/project/backend/scripts
railway connect Postgres
```
In your railway db psql shell run:
```
-- should be in the psql railway terminal with railway=#
\i dbexport.psql
```

# SUBMISSION.md
Please fill out the SUBMISSION.md file to ensure we have your name and email attached to the project along with the frontend public domain URL to access your deployed project.

# Questions?

Email datasolutions@okcthunder.com
