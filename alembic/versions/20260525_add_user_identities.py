"""add user identities

Revision ID: 20260525_user_identity
Revises: 890659c554b6
Create Date: 2026-05-25 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260525_user_identity"
down_revision: str | Sequence[str] | None = "890659c554b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "useridentity" not in inspector.get_table_names():
        op.create_table(
            "useridentity",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("provider", sa.String(), nullable=False),
            sa.Column("provider_subject", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=True),
            sa.Column("username", sa.String(), nullable=True),
            sa.Column("display_name", sa.String(), nullable=True),
            sa.Column("raw_profile", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["user.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("provider", "provider_subject", name="unique_provider_subject"),
        )
        op.create_index(op.f("ix_useridentity_id"), "useridentity", ["id"], unique=False)
        op.create_index(op.f("ix_useridentity_user_id"), "useridentity", ["user_id"], unique=False)
        op.create_index(op.f("ix_useridentity_provider"), "useridentity", ["provider"], unique=False)
        op.create_index(op.f("ix_useridentity_provider_subject"), "useridentity", ["provider_subject"], unique=False)
        op.create_index(op.f("ix_useridentity_email"), "useridentity", ["email"], unique=False)

    user_columns = {column["name"]: column for column in inspector.get_columns("user")}
    hashed_password = user_columns.get("hashed_password")
    if hashed_password and not hashed_password["nullable"]:
        with op.batch_alter_table("user") as batch_op:
            batch_op.alter_column(
                "hashed_password",
                existing_type=sa.String(),
                existing_nullable=False,
                nullable=True,
            )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    user_columns = {column["name"]: column for column in inspector.get_columns("user")}
    hashed_password = user_columns.get("hashed_password")
    if hashed_password and hashed_password["nullable"]:
        with op.batch_alter_table("user") as batch_op:
            batch_op.alter_column(
                "hashed_password",
                existing_type=sa.String(),
                existing_nullable=True,
                nullable=False,
            )

    if "useridentity" in inspector.get_table_names():
        existing_indexes = {index["name"] for index in inspector.get_indexes("useridentity")}
        for index_name in (
            op.f("ix_useridentity_email"),
            op.f("ix_useridentity_provider_subject"),
            op.f("ix_useridentity_provider"),
            op.f("ix_useridentity_user_id"),
            op.f("ix_useridentity_id"),
        ):
            if index_name in existing_indexes:
                op.drop_index(index_name, table_name="useridentity")
        op.drop_table("useridentity")
