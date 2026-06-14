// Use native fetch

async function run() {
  const payload = {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "932955362642797",
        "changes": [
          {
            "value": {
              "messaging_product": "whatsapp",
              "metadata": {
                "display_phone_number": "15550865555",
                "phone_number_id": "1000177549846403"
              },
              "contacts": [
                {
                  "profile": {
                    "name": "Rafael Sanz Test"
                  },
                  "wa_id": "17862554332"
                }
              ],
              "messages": [
                {
                  "from": "17862554332",
                  "id": "wamid.HBgLMTc4NjI1NTQzMzIVAhIAEhgWM0VCMDQ5NTZCMkI1RjM1MDU1NUFCAA==",
                  "timestamp": "1779410185",
                  "text": {
                    "body": "Hola, esto es una prueba de respuesta del cliente"
                  },
                  "type": "text"
                }
              ]
            },
            "field": "messages"
          }
        ]
      }
    ]
  };

  try {
    console.log('Sending simulated webhook to http://localhost:3001/api/webhooks/meta/whatsapp...');
    const response = await fetch('http://localhost:3001/api/webhooks/meta/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Response Status:', response.status);
    const text = await response.text();
    console.log('Response Text:', text);
  } catch (err: any) {
    console.error('Error sending webhook:', err.message || err);
  }
}
run();
