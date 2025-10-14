# PostgreSQL Setup for macOS (zsh)

## Step 1: Install PostgreSQL with Homebrew

```zsh
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install PostgreSQL
brew install postgresql@16

# Install PostGIS (required for geospatial queries)
brew install postgis
```

## Step 2: Start PostgreSQL Service

```zsh
# Start PostgreSQL now
brew services start postgresql@16

# Or start manually (won't auto-start on reboot)
pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

## Step 3: Verify Installation

```zsh
# Check PostgreSQL is running
brew services list | grep postgresql

# Should show: postgresql@16 started
```

## Step 4: Create Database and User

```zsh
# Connect to PostgreSQL as default user
psql postgres

# Inside psql prompt, run these commands:
```

In the PostgreSQL prompt:
```sql
-- Create database
CREATE DATABASE chayakkada;

-- Create user with password (optional, for production)
CREATE USER chayakkada_user WITH PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE chayakkada TO chayakkada_user;

-- Connect to the database
\c chayakkada

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is installed
SELECT PostGIS_Version();

-- Exit psql
\q
```

## Step 5: Get Your Connection String

For **development** (using default user):
```
DATABASE_URL=postgresql://localhost:5432/chayakkada
```

For **production** (with user/password):
```
DATABASE_URL=postgresql://chayakkada_user:your_secure_password@localhost:5432/chayakkada
```

## Step 6: Update .env File

```zsh
# Edit your .env file
nano .env
```

Add:
```env
DATABASE_URL=postgresql://localhost:5432/chayakkada
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
NODE_ENV=development
PORT=3000
```

## Step 7: Test Connection

```zsh
# Start your app
npm start

# You should see:
# Connected to SQLite database
# Database schema initialized successfully
# Server running on http://localhost:3000
```

## Common Issues

### PostgreSQL won't start
```zsh
# Check if port 5432 is already in use
lsof -i :5432

# If something is using it, kill it or use a different port
```

### Can't find psql command
```zsh
# Add PostgreSQL to your PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### PostGIS not found
```zsh
# Reinstall PostGIS
brew reinstall postgis

# Then reconnect to database and run:
# CREATE EXTENSION IF NOT EXISTS postgis;
```

## Useful PostgreSQL Commands

```zsh
# Start PostgreSQL
brew services start postgresql@16

# Stop PostgreSQL
brew services stop postgresql@16

# Restart PostgreSQL
brew services restart postgresql@16

# Connect to a database
psql chayakkada

# List all databases
psql -l

# Backup database
pg_dump chayakkada > backup.sql

# Restore database
psql chayakkada < backup.sql
```

## Inside psql Useful Commands

```sql
\l              -- List all databases
\c dbname       -- Connect to database
\dt             -- List all tables
\d table_name   -- Describe table
\du             -- List users
\q              -- Quit
```

## Alternative: Using GUI Tools

If you prefer GUI tools:
- **Postico 2** (free) - [https://eggerapps.at/postico2/](https://eggerapps.at/postico2/)
- **pgAdmin** (free) - [https://www.pgadmin.org/](https://www.pgadmin.org/)
- **TablePlus** (paid, free trial) - [https://tableplus.com/](https://tableplus.com/)

Connection details:
- Host: localhost
- Port: 5432
- Database: chayakkada
- User: your_username (default is your macOS username)
- Password: (leave empty for local dev)
