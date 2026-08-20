"""add_recognition_history

Revision ID: 3c8e401b2a9f
Revises: ba802af4cb4d
Create Date: 2026-08-20 01:00:00.000000+00:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3c8e401b2a9f'
down_revision: Union[str, None] = 'ba802af4cb4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Upgrade database schema."""
    op.create_table(
        'recognition_history',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('employee_uuid', sa.Uuid(), nullable=True),
        sa.Column('employee_id', sa.String(length=100), nullable=True),
        sa.Column('employee_name', sa.String(length=255), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('camera_name', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['employee_uuid'], ['employees.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_recognition_history_employee_id'), 'recognition_history', ['employee_id'], unique=False)
    op.create_index(op.f('ix_recognition_history_timestamp'), 'recognition_history', ['timestamp'], unique=False)

def downgrade() -> None:
    """Downgrade database schema."""
    op.drop_index(op.f('ix_recognition_history_timestamp'), table_name='recognition_history')
    op.drop_index(op.f('ix_recognition_history_employee_id'), table_name='recognition_history')
    op.drop_table('recognition_history')
