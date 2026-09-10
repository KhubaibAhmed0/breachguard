import os
import uvicorn
import gradio as gr
from main import app as fastapi_app

with gr.Blocks(title=BreachGuard API) as demo:
    gr.Markdown(# BreachGuard Threat Intelligence Engine)
    gr.Markdown(Backend API status: **Active & Operational**)
    gr.Markdown(- [Interactive Swagger API Documentation](/docs))
    gr.Markdown(- [OpenAPI Specification](/openapi.json))

app = gr.mount_gradio_app(fastapi_app, demo, path=/)

if __name__ == __main__:
    port = int(os.environ.get(PORT, 7860))
    uvicorn.run(app, host=0.0.0.0, port=port)
