import asyncio

from sqlalchemy import text

from database import engine


async def test_database():
    try:
        async with engine.connect() as connection:
            result = await connection.execute(
                text("SELECT 1")
            )

            print("DATABASE CONNECTION SUCCESS")
            print("RESULT:", result.scalar())

    except Exception as error:
        print("DATABASE CONNECTION FAILED")
        print(type(error).__name__)
        print(error)

    finally:
        await engine.dispose()


asyncio.run(test_database())