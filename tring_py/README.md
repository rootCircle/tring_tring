# tring_py

> [!WARNING]
> clean_sql script(make/just) will remove all the tables and types from the database, so use at caution

## A bit of uv

`uv` is an exceptionally fast Python package manager that works similarly to Node.js with its `package.json`. While Python has tools like `requirements.txt` and the newer `pyproject.toml`, `uv` takes things further by managing your entire environment for you. From handling the Python version to managing your dependencies, `uv` simplifies the process and provides a seamless experience.

### Getting Started with `uv`
1. **Install `uv`**: Follow the instructions on the [official documentation](https://docs.astral.sh/uv/getting-started/installation/).  
2. **Set up your project**: Clone or download this repository.

Once you have the repository, run:  
```bash
uv sync
```  
This command will download all dependencies defined in the `pyproject.toml` file. The project includes a robust set of pre-installed dependencies for tasks like LLM training.  

### Adding Dependencies
If you need additional dependencies, simply run:  
```bash
uv add <package-name>
```  
This installs the package and updates your environment automatically.

### Running Your Code
You can execute your code using:  
```bash
uv run python3 main.py
```  
(Optional) For convenience, you can also use aliases or automation tools. For example:  
- Use `just run` if you have [Just installed](https://github.com/casey/just?tab=readme-ov-file#packages).  
- Alternatively, `make run` works well if you have make installed.

### Enhancing Your Workflow with PostgreSQL
To test PostgreSQL queries locally, you can use `psql` on your local machine or run a PostgreSQL instance with Docker.

#### Running PostgreSQL with Docker
Use the following Docker command to spawn a PostgreSQL instance and access it interactively via `psql`:

```bash
docker run -it --rm -p 5432:5432 postgres:17-alpine psql -U postgres
```

With this setup, you can easily experiment with your database queries locally or integrate them into your project.  


