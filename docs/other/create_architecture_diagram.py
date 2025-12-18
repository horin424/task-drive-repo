# docs/create_architecture_diagram.py
#
# このスクリプトは、diagramsライブラリを使用してシステムの構成図を生成します。
#
# --- 前提条件 ---
# 1. Graphviz のインストール:
#    - macOS: brew install graphviz
#    - Windows: choco install graphviz
#    - Ubuntu: sudo apt-get install graphviz
#    - 公式サイト: https://graphviz.org/download/
#
# 2. Pythonライブラリのインストール:
#    pip install diagrams
#
# --- 実行方法 ---
# このファイルがあるディレクトリで以下のコマンドを実行すると、
# "transcript_minute_architecture.png" という名前の画像ファイルが生成されます。
#
# python create_architecture_diagram.py
#

from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.network import APIGateway
from diagrams.aws.storage import S3
from diagrams.aws.database import Dynamodb
from diagrams.aws.security import Cognito, SecretsManager
from diagrams.aws.integration import Appsync
from diagrams.aws.general import User
from diagrams.onprem.client import Client as OnpremClient # Clientクラスの衝突を避ける

graph_attr = {
    "fontsize": "12",
    "bgcolor": "transparent",
    "compound": "true", # クラスター間のエッジを許可
}

with Diagram("非同期処理を導入したシステム構成図", show=False, filename="transcript_minute_architecture", graph_attr=graph_attr, direction="TB"):
    
    with Cluster(""):
        user = User("ユーザー")

    with Cluster("外部AIサービス"):
        external_ai = OnpremClient("Dify / ElevenLabs API")

    with Cluster("AWSクラウド (Amplify管理)"):
        frontend = OnpremClient("Next.js フロントエンド")

        with Cluster("認証 & 設定"):
            cognito = Cognito("Cognito")
            secrets_manager = SecretsManager("Secrets Manager")
        
        with Cluster("データストア & 状態管理"):
            s3_input = S3("入力バケット")
            s3_output = S3("出力バケット")
            appsync = Appsync("AppSync (GraphQL)")
            dynamodb = Dynamodb("DynamoDB")
            
            appsync >> Edge(label="CRUD") >> dynamodb

        with Cluster("非同期処理 & API"):
            api_gw = APIGateway("API Gateway")
            
            with Cluster("文字起こしプロセス"):
                lambda_transcription = Lambda("transcriptionProcessor")

            with Cluster("コンテンツ生成プロセス"):
                lambda_endpoint = Lambda("generationProcessor")
                lambda_worker = Lambda("generationWorker")

    # --- 認証フロー ---
    user >> Edge(label="ログイン") >> frontend
    frontend - cognito

    # --- 文字起こしフロー (S3トリガー) ---
    lhead_transcription = "cluster_文字起こしプロセス" # クラスターのID
    
    frontend >> Edge(label="1. ファイルアップロード") >> s3_input
    s3_input >> Edge(label="2. S3トリガー", style="dotted", color="firebrick") >> lambda_transcription
    
    lambda_transcription >> Edge(label="APIキー取得", lhead=lhead_transcription) >> secrets_manager
    lambda_transcription >> Edge(label="文字起こし依頼") >> external_ai
    lambda_transcription >> Edge(label="結果を保存") >> s3_output
    lambda_transcription >> Edge(label="ステータス更新", lhead=lhead_transcription) >> appsync


    # --- コンテンツ生成フロー (API Gatewayトリガー) ---
    lhead_generation = "cluster_コンテンツ生成プロセス"
    
    frontend >> Edge(label="3. 生成リクエスト") >> api_gw
    api_gw >> Edge(label="4. 同期呼び出し", style="dotted") >> lambda_endpoint
    lambda_endpoint >> Edge(label="5. 非同期呼び出し", style="dotted", color="firebrick") >> lambda_worker
    frontend << Edge(label="202 Accepted", style="dashed") << lambda_endpoint
    
    lambda_worker >> Edge(label="APIキー取得", lhead=lhead_generation) >> secrets_manager
    lambda_worker >> Edge(label="コンテンツ生成依頼") >> external_ai
    lambda_worker >> Edge(label="結果を保存") >> s3_output
    lambda_worker >> Edge(label="ステータス更新", lhead=lhead_generation) >> appsync

    # --- フロントエンドとデータ層の連携 ---
    frontend << Edge(label="リアルタイム更新 (Subscription)", style="dashed", color="darkgreen") >> appsync
    frontend >> Edge(label="結果ダウンロード") >> s3_output 