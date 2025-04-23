# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# Use --no-cache-dir to reduce image size
# Use --pre to allow installing pre-release versions like the specified yt-dlp
RUN pip install --no-cache-dir --pre -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

# Make port 8001 available to the world outside this container
EXPOSE 8001

# Define environment variable defaults (optional, can be overridden)
# Ensure python output is sent straight to terminal without buffering
ENV PYTHONUNBUFFERED=1
# Note: API_BEARER_TOKEN should be set at runtime, not here.

# Run main.py when the container launches
CMD ["python", "api.py"]