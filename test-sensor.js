const SERVER_URL = 'http://localhost:3000/api/sensors/event'

async function sendSensorData(sensorId, value) {
    const payload = { sensor_id: sensorId, value: value };
    await fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    console.log("Данные отправлены!");
}

sendSensorData(2, "FIRE");