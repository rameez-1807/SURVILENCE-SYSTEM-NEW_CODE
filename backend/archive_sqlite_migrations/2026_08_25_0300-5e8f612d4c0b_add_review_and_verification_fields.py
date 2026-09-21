"""add_review_and_verification_fields

Revision ID: 5e8f612d4c0b
Revises: 4d9f512c3b0a
Create Date: 2026-08-25 14:10:00.000000+00:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '5e8f612d4c0b'
down_revision: Union[str, None] = '4d9f512c3b0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('needs_review', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('is_llm_verified', sa.Boolean(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('corrected_label', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_column('corrected_label')
        batch_op.drop_column('is_llm_verified')
        batch_op.drop_column('needs_review')
