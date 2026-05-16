Done reading both. Here is my full analysis:

Connection options — 100% identical

Option	index.html	useMqtt.ts
Broker URL	wss://broker.hivemq.com:8884/mqtt	wss://broker.hivemq.com:8884/mqtt ✓
connectTimeout	4000	4000 ✓
reconnectPeriod	1000	1000 ✓
clientId	web_ + random hex	web_ + random hex ✓
clean	true	true ✓
Events — 100% identical

connect / reconnect / close / error — same in both ✓

sendCommand logic — 100% identical

Same connected check, same topic locker/${lockerId}/cmd, same payload string, same qos:0 retain:false ✓

The actual problem I found

index.html has the locker ID as an input field the user types — default value is L01.

Your app takes it from the URL. From your logs:


GET /locker/L001/success   ← three zeros
So your app publishes to locker/L001/cmd but the ESP8266 in the index.html defaults to L01 (two zeros). They are different topics — the ESP never receives it.

Check your MongoDB locker document right now — run this in MongoDB Atlas or Compass:


db.lockers.find({}, { locker_id: 1 })
Whatever value locker_id is in the DB is what gets published. It must exactly match what your ESP firmware has in its mqtt.subscribe() call. One extra zero breaks everything.

