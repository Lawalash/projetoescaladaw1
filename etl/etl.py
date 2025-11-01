#!/usr/bin/env python3
"""
QW1 ETL - Extração, Transformação e Carga de dados CSV para MySQL
Suporta CSV e Excel (XLSX)
"""

import sys
import os
import argparse
import json
from datetime import datetime
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurações do banco
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'qw1_relatorios')

# String de conexão MySQL
CONNECTION_STRING = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


def validar_colunas(df):
    """
    Valida se o DataFrame possui as colunas obrigatórias
    """
    colunas_obrigatorias = ['data_venda', 'produto', 'preco_unitario']
    colunas_faltando = [col for col in colunas_obrigatorias if col not in df.columns]
    
    if colunas_faltando:
        raise ValueError(f"Colunas obrigatórias faltando: {', '.join(colunas_faltando)}")
    
    return True


def limpar_dados(df):
    """
    Limpa e transforma os dados
    """
    # Criar cópia para não modificar original
    df_clean = df.copy()
    
    # Remover linhas completamente vazias
    df_clean = df_clean.dropna(how='all')
    
    # Converter data_venda para datetime
    df_clean['data_venda'] = pd.to_datetime(df_clean['data_venda'], errors='coerce')
    
    # Converter hora_venda (se existir)
    if 'hora_venda' in df_clean.columns:
        df_clean['hora_venda'] = pd.to_datetime(df_clean['hora_venda'], format='%H:%M:%S', errors='coerce').dt.time
    else:
        df_clean['hora_venda'] = None
    
    # Preencher valores padrão
    if 'loja' not in df_clean.columns:
        df_clean['loja'] = 'Loja Padrão'
    else:
        df_clean['loja'] = df_clean['loja'].fillna('Loja Padrão')
    
    if 'quantidade' not in df_clean.columns:
        df_clean['quantidade'] = 1
    else:
        df_clean['quantidade'] = pd.to_numeric(df_clean['quantidade'], errors='coerce').fillna(1).astype(int)
    
    # Converter valores numéricos
    df_clean['preco_unitario'] = pd.to_numeric(df_clean['preco_unitario'], errors='coerce')
    
    # Calcular total se não existir
    if 'total' not in df_clean.columns or df_clean['total'].isna().all():
        df_clean['total'] = df_clean['quantidade'] * df_clean['preco_unitario']
    else:
        df_clean['total'] = pd.to_numeric(df_clean['total'], errors='coerce')
        # Recalcular onde total está vazio
        mask = df_clean['total'].isna()
        df_clean.loc[mask, 'total'] = df_clean.loc[mask, 'quantidade'] * df_clean.loc[mask, 'preco_unitario']
    
    # Remover linhas com dados críticos inválidos
    df_clean = df_clean.dropna(subset=['data_venda', 'produto', 'preco_unitario'])
    
    # Selecionar apenas colunas necessárias
    colunas_finais = ['data_venda', 'hora_venda', 'loja', 'produto', 'quantidade', 'preco_unitario', 'total']
    df_clean = df_clean[colunas_finais]
    
    return df_clean


def processar_arquivo(file_path, engine):
    """
    Processa arquivo CSV ou Excel e carrega no MySQL
    """
    # Verificar se arquivo existe
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Arquivo não encontrado: {file_path}")
    
    # Detectar tipo de arquivo e ler
    extensao = os.path.splitext(file_path)[1].lower()
    
    print(f"📂 Lendo arquivo: {file_path}")
    
    if extensao == '.csv':
        df = pd.read_csv(file_path)
    elif extensao in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
    else:
        raise ValueError(f"Formato de arquivo não suportado: {extensao}")
    
    print(f"   Linhas lidas: {len(df)}")
    
    # Validar colunas
    validar_colunas(df)
    print("   ✅ Colunas validadas")
    
    # Limpar dados
    df_clean = limpar_dados(df)
    linhas_removidas = len(df) - len(df_clean)
    
    if linhas_removidas > 0:
        print(f"   ⚠️  {linhas_removidas} linhas removidas (dados inválidos)")
    
    print(f"   Linhas válidas para inserção: {len(df_clean)}")
    
    # Inserir no banco
    try:
        df_clean.to_sql(
            name='vendas',
            con=engine,
            if_exists='append',
            index=False,
            chunksize=1000
        )
        print(f"   ✅ {len(df_clean)} linhas inseridas com sucesso!")
        
        return {
            'sucesso': True,
            'linhas_lidas': len(df),
            'linhas_inseridas': len(df_clean),
            'linhas_descartadas': linhas_removidas
        }
        
    except Exception as e:
        print(f"   ❌ Erro ao inserir dados: {str(e)}")
        raise


def main():
    """
    Função principal
    """
    parser = argparse.ArgumentParser(description='ETL QW1 - Importar CSV/Excel para MySQL')
    parser.add_argument('--file', required=True, help='Caminho do arquivo CSV ou Excel')
    parser.add_argument('--output-json', action='store_true', help='Retornar resultado em JSON')
    
    args = parser.parse_args()
    
    inicio = datetime.now()
    
    try:
        print("\n" + "="*60)
        print("QW1 ETL - Iniciando processamento")
        print("="*60 + "\n")
        
        # Criar engine de conexão
        engine = create_engine(CONNECTION_STRING)
        
        # Testar conexão
        with engine.connect() as conn:
            print("✅ Conexão com MySQL estabelecida\n")
        
        # Processar arquivo
        resultado = processar_arquivo(args.file, engine)
        
        # Calcular tempo de execução
        tempo_execucao = (datetime.now() - inicio).total_seconds()
        resultado['tempo_execucao'] = f"{tempo_execucao:.2f}s"
        
        print("\n" + "="*60)
        print("✅ ETL Concluído com Sucesso!")
        print("="*60)
        print(f"Linhas processadas: {resultado['linhas_lidas']}")
        print(f"Linhas inseridas: {resultado['linhas_inseridas']}")
        print(f"Linhas descartadas: {resultado['linhas_descartadas']}")
        print(f"Tempo de execução: {resultado['tempo_execucao']}")
        print("="*60 + "\n")
        
        # Retornar JSON se solicitado (para integração com Node)
        if args.output_json:
            print(json.dumps(resultado))
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Erro fatal: {str(e)}\n")
        
        if args.output_json:
            print(json.dumps({
                'sucesso': False,
                'erro': str(e)
            }))
        
        return 1


if __name__ == '__main__':
    sys.exit(main())