#!/usr/bin/env python3
"""ETL A2 Data Monitoramento Ocupacional - Importação de planilhas para o banco do lar"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import List

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine


load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "aurora_care")

CONNECTION_STRING = (
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)


@dataclass
class ResultadoETL:
    sucesso: bool
    registros_lidos: int
    registros_inseridos: int
    registros_descartados: int
    erros: List[str]

    def to_dict(self) -> dict:
        return {
            "sucesso": self.sucesso,
            "registros_lidos": self.registros_lidos,
            "registros_inseridos": self.registros_inseridos,
            "registros_descartados": self.registros_descartados,
            "erros": self.erros,
        }


def ler_planilha(caminho: str) -> pd.DataFrame:
    if not os.path.exists(caminho):
        raise FileNotFoundError(f"Arquivo não encontrado: {caminho}")

    extensao = os.path.splitext(caminho)[1].lower()
    if extensao == ".csv":
        return pd.read_csv(caminho)
    if extensao in {".xlsx", ".xls"}:
        return pd.read_excel(caminho)
    raise ValueError("Formato de arquivo não suportado. Use CSV ou Excel.")


def preparar_estoque(df: pd.DataFrame, tipo: str) -> pd.DataFrame:
    df = df.copy()
    df.columns = [col.strip().lower() for col in df.columns]

    obrigatorias = {"categoria", "item", "quantidade", "unidade"}
    faltando = obrigatorias.difference(set(df.columns))
    if faltando:
        raise ValueError(
            "Planilha de estoque deve conter as colunas: " + ", ".join(sorted(faltando))
        )

    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce").fillna(0)
    if "consumo_diario" in df.columns:
        df["consumo_diario"] = pd.to_numeric(
            df["consumo_diario"], errors="coerce"
        ).fillna(0)
    else:
        df["consumo_diario"] = 0

    if "validade" in df.columns:
        df["validade"] = pd.to_datetime(df["validade"], errors="coerce")
    else:
        df["validade"] = pd.NaT

    df["categoria"] = df["categoria"].fillna("Geral").astype(str)
    df["item"] = df["item"].fillna("Sem descrição").astype(str)
    df["unidade"] = df["unidade"].fillna("un").astype(str)
    df["tipo"] = tipo
    df["lote"] = df.get("lote", pd.Series([None] * len(df)))
    df["fornecedor"] = df.get("fornecedor", pd.Series([None] * len(df)))
    df["observacoes"] = df.get("observacoes", pd.Series([None] * len(df)))

    colunas = [
        "tipo",
        "categoria",
        "item",
        "unidade",
        "quantidade",
        "consumo_diario",
        "validade",
        "lote",
        "fornecedor",
        "observacoes",
    ]
    return df[colunas]


def preparar_saude(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [col.strip().lower() for col in df.columns]

    obrigatorias = {
        "data_ref",
        "pressao_sistolica",
        "pressao_diastolica",
        "frequencia_cardiaca",
        "glicemia",
    }
    faltando = obrigatorias.difference(set(df.columns))
    if faltando:
        raise ValueError(
            "Planilha de saúde deve conter as colunas: " + ", ".join(sorted(faltando))
        )

    df["data_ref"] = pd.to_datetime(df["data_ref"], errors="coerce")
    df = df.dropna(subset=["data_ref"])

    numericas = [
        "pressao_sistolica",
        "pressao_diastolica",
        "frequencia_cardiaca",
        "glicemia",
        "incidentes_quedas",
        "internacoes",
        "pontuacao_bem_estar",
        "taxa_ocupacao",
        "taxa_obito",
    ]
    for coluna in numericas:
        if coluna in df.columns:
            df[coluna] = pd.to_numeric(df[coluna], errors="coerce").fillna(0)
        else:
            df[coluna] = 0

    return df[
        [
            "data_ref",
            "pressao_sistolica",
            "pressao_diastolica",
            "frequencia_cardiaca",
            "glicemia",
            "incidentes_quedas",
            "internacoes",
            "pontuacao_bem_estar",
            "taxa_ocupacao",
            "taxa_obito",
        ]
    ]


def importar_planilha(caminho: str, tipo: str, engine) -> ResultadoETL:
    df = ler_planilha(caminho)
    registros_lidos = len(df)

    if registros_lidos == 0:
        return ResultadoETL(True, 0, 0, 0, ["Planilha sem registros."])

    if tipo in {"estoque_alimentos", "estoque_limpeza"}:
        preparado = preparar_estoque(df, "alimentos" if "alimentos" in tipo else "limpeza")
        tabela = "estoque_itens"
    elif tipo == "saude_diaria":
        preparado = preparar_saude(df)
        tabela = "metricas_saude"
    else:
        raise ValueError("Tipo de importação desconhecido.")

    descartados = registros_lidos - len(preparado)

    preparado.to_sql(
        tabela,
        con=engine,
        if_exists="append",
        index=False,
        chunksize=100,
        method="multi",
    )

    return ResultadoETL(
        True,
        registros_lidos,
        len(preparado),
        descartados,
        [],
    )


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Importar planilhas para o A2 Data Monitoramento Ocupacional")
    parser.add_argument("--file", required=True, help="Caminho para a planilha CSV/XLSX")
    parser.add_argument(
        "--tipo",
        choices=["estoque_alimentos", "estoque_limpeza", "saude_diaria"],
        default="estoque_alimentos",
        help="Tipo de dados que será importado",
    )
    parser.add_argument("--output-json", action="store_true", help="Retornar resultado em JSON")

    args = parser.parse_args(argv)

    engine = create_engine(CONNECTION_STRING)

    try:
        resultado = importar_planilha(args.file, args.tipo, engine)
    except Exception as exc:  # pylint: disable=broad-except
        mensagem = f"Erro ao processar planilha: {exc}"
        if args.output_json:
            print(json.dumps({"sucesso": False, "erro": mensagem}, ensure_ascii=False))
        else:
            print(mensagem)
        return 1

    if args.output_json:
        print(json.dumps(resultado.to_dict(), default=str, ensure_ascii=False))
    else:
        print("✅ Importação concluída")
        print(f"   Registros lidos: {resultado.registros_lidos}")
        print(f"   Inseridos: {resultado.registros_inseridos}")
        if resultado.registros_descartados:
            print(f"   Descartados: {resultado.registros_descartados}")
        if resultado.erros:
            print("   Erros:")
            for erro in resultado.erros:
                print(f"     - {erro}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
