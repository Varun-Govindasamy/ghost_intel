"""
GhostIntel Main Entry Point
"""


import uvicorn


def main():
    """Run the GhostIntel API server"""
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   🔮 GhostIntel - Autonomous Company Intelligence         ║
    ║                                                           ║
    ║   Starting server at http://localhost:8000                ║
    ║   API Documentation: http://localhost:8000/docs           ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "ghostintel.api:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disabled - reload breaks Windows asyncio subprocess
        log_level="info",
        loop="asyncio",
    )


if __name__ == "__main__":
    main()
