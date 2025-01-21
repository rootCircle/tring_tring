import pandas as pd
import matplotlib.pyplot as plt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import text
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres"
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

def clean_stock_data():
    try:
        query = text("""
        DELETE FROM stock_data
        WHERE ctid NOT IN (
            SELECT MIN(ctid)
            FROM stock_data
            GROUP BY symbol, timestamp
        );
        """)
        session.execute(query)
        session.commit()
        logging.info("Stock data cleaned successfully.")
    except Exception as e:
        logging.error(f"Error cleaning stock data: {e}")
        raise

def get_cleaned_stock_data():
    try:
        query = """
        SELECT symbol, timestamp, price, volume
        FROM stock_data
        WHERE timestamp >= NOW() - INTERVAL '1 day'
        """
        stock_data = pd.read_sql(query, engine)
        if stock_data.empty:
            logging.warning("No stock data found for the last 24 hours.")
        return stock_data
    except Exception as e:
        logging.error(f"Error retrieving stock data: {e}")
        raise

def get_news_sentiment_data():
    try:
        query = """
        SELECT symbol, timestamp, sentiment_score
        FROM news_sentiment
        WHERE sentiment_score > 0.8 AND timestamp >= NOW() - INTERVAL '1 day'
        """
        sentiment_data = pd.read_sql(query, engine)
        if sentiment_data.empty:
            logging.warning("No sentiment data found for the last 24 hours.")
        return sentiment_data
    except Exception as e:
        logging.error(f"Error retrieving sentiment data: {e}")
        raise

def merge_data(stock_data, sentiment_data):
    try:
        stock_data['timestamp'] = pd.to_datetime(stock_data['timestamp'])
        sentiment_data['timestamp'] = pd.to_datetime(sentiment_data['timestamp'])
        merged_data = pd.merge_asof(stock_data.sort_values('timestamp'), sentiment_data.sort_values('timestamp'),
                                    on='timestamp', by='symbol', direction='nearest')
        merged_data['price_change'] = merged_data.groupby('symbol')['price'].diff().shift(-1)
        merged_data['label'] = merged_data['price_change'].apply(lambda x: 1 if x > 0 else 0)
        logging.info("Data merged successfully.")
        return merged_data
    except Exception as e:
        logging.error(f"Error merging data: {e}")
        raise

def save_labeled_data(merged_data):
    try:
        merged_data.to_csv('labeled_sentiment_stock.csv', index=False)
        logging.info("Labeled data saved to 'labeled_sentiment_stock.csv'.")
    except Exception as e:
        logging.error(f"Error saving labeled data: {e}")
        raise

def plot_stock_trends(stock_data, sentiment_data):
    try:
        fig, ax1 = plt.subplots(figsize=(10, 6))
        ax1.plot(stock_data['timestamp'], stock_data['price'], color='tab:blue', label='Stock Price')
        ax1.set_xlabel('Time')
        ax1.set_ylabel('Stock Price', color='tab:blue')
        ax1.tick_params(axis='y', labelcolor='tab:blue')

        ax2 = ax1.twinx()
        ax2.scatter(sentiment_data['timestamp'], sentiment_data['sentiment_score'], color='tab:orange', label='Sentiment Score')
        ax2.set_ylabel('Sentiment Score', color='tab:orange')
        ax2.tick_params(axis='y', labelcolor='tab:orange')

        fig.tight_layout()
        plt.title('Stock Price and Sentiment Trends')
        plt.savefig('sentiment_stock_trends.png')
        logging.info("Sentiment and stock trends plot saved to 'sentiment_stock_trends.png'.")
    except Exception as e:
        logging.error(f"Error plotting stock trends: {e}")
        raise

def main():
    try:
        clean_stock_data()
        stock_data = get_cleaned_stock_data()
        sentiment_data = get_news_sentiment_data()
        
        if stock_data.empty or sentiment_data.empty:
            logging.error("Empty datasets, exiting process.")
            return
        
        merged_data = merge_data(stock_data, sentiment_data)
        save_labeled_data(merged_data)
        plot_stock_trends(stock_data, sentiment_data)
        logging.info("Task completed: Stock data cleaned, merged, labeled, and trends plotted.")
    except Exception as e:
        logging.error(f"Error in the main process: {e}")

if __name__ == "__main__":
    main()

